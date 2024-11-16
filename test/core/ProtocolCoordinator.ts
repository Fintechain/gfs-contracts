import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { ProtocolCoordinator, MockMessageRegistry, MockMessageProtocol, MockMessageRouter, MockMessageProcessor, MockSettlementController } from "../../typechain";

enum MessageStatus {
    PENDING,
    DELIVERED,
    PROCESSED,
    FAILED,
    SETTLED,
    CANCELLED
}

describe("ProtocolCoordinator", function () {
    let protocolCoordinator: ProtocolCoordinator;
    let messageRegistry: MockMessageRegistry;
    let messageProtocol: MockMessageProtocol;
    let messageRouter: MockMessageRouter;
    let messageProcessor: MockMessageProcessor;
    let settlementController: MockSettlementController;

    // Test values
    const testMessageType = ethers.encodeBytes32String("TEST_MESSAGE");
    const testPayload = ethers.toUtf8Bytes("test-payload");
    const testMessageHash = ethers.keccak256(testPayload);

    beforeEach(async function () {
        // Deploy all contracts fresh for each test
        await deployments.fixture(['mocks', 'ProtocolCoordinator_Test']);

        const mockRegistryDeployment = await deployments.get('MockMessageRegistry');
        const mockProtocolDeployment = await deployments.get('MockMessageProtocol');
        const mockRouterDeployment = await deployments.get('MockMessageRouter');
        const mockProcessorDeployment = await deployments.get('MockMessageProcessor');
        const mockSettlementDeployment = await deployments.get('MockSettlementController');

        messageRegistry = await ethers.getContractAt("MockMessageRegistry", mockRegistryDeployment.address);
        messageProtocol = await ethers.getContractAt("MockMessageProtocol", mockProtocolDeployment.address);
        messageRouter = await ethers.getContractAt("MockMessageRouter", mockRouterDeployment.address);
        messageProcessor = await ethers.getContractAt("MockMessageProcessor", mockProcessorDeployment.address);
        settlementController = await ethers.getContractAt("MockSettlementController", mockSettlementDeployment.address);

        const protocolCoordinatorDeployment = await deployments.get('ProtocolCoordinator');
        protocolCoordinator = await ethers.getContractAt("ProtocolCoordinator", protocolCoordinatorDeployment.address);

        // Configure mocks - this is all we need for validation!
        await messageProtocol.setValidationResult(true);
        await messageRouter.setQuoteResult(ethers.parseEther("0.1"));
        await settlementController.setQuoteResult(ethers.parseEther("0.05"));
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await protocolCoordinator.hasRole(await protocolCoordinator.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
        });

        it("Should set protocol components correctly", async function () {
            expect(await protocolCoordinator.messageRegistry()).to.equal(await messageRegistry.getAddress());
            expect(await protocolCoordinator.messageProtocol()).to.equal(await messageProtocol.getAddress());
            expect(await protocolCoordinator.messageRouter()).to.equal(await messageRouter.getAddress());
            expect(await protocolCoordinator.messageProcessor()).to.equal(await messageProcessor.getAddress());
            expect(await protocolCoordinator.settlementController()).to.equal(await settlementController.getAddress());
        });

        it("Should have correct initial configuration", async function () {
            expect(await protocolCoordinator.baseFee()).to.equal(ethers.parseEther("0.001"));
            expect(await protocolCoordinator.MAX_MESSAGE_SIZE()).to.equal(1024 * 1024); // 1MB
        });
    });

    describe("Message Submission", function () {
        it("Should submit message successfully without settlement", async function () {
            const { admin, user } = await getNamedAccounts();
            const submission = {
                messageType: testMessageType,
                target: user,
                targetChain: 1,
                payload: testPayload,
                settlementData: {
                    sourceToken: ethers.ZeroAddress,
                    targetToken: ethers.ZeroAddress,
                    amount: 0n,
                    recipient: user
                }
            };

            const [baseFee, deliveryFee, settlementFee] = await protocolCoordinator.quoteMessageFee(submission);
            const totalFee = baseFee + deliveryFee + settlementFee;

            await expect(protocolCoordinator.connect(await ethers.getSigner(admin))
                .submitMessage(submission, { value: totalFee }))
                .to.emit(protocolCoordinator, "MessageSubmissionInitiated");
        });

        it("Should handle settlement correctly", async function () {
            const { admin, user } = await getNamedAccounts();
            const submission = {
                messageType: testMessageType,
                target: user,
                targetChain: 1,
                payload: testPayload,
                settlementData: {
                    sourceToken: await settlementController.getAddress(),
                    targetToken: await settlementController.getAddress(),
                    amount: ethers.parseEther("1.0"),
                    recipient: user
                }
            };

            const [baseFee, deliveryFee, settlementFee] = await protocolCoordinator.quoteMessageFee(submission);
            const totalFee = baseFee + deliveryFee + settlementFee;

            await expect(protocolCoordinator.connect(await ethers.getSigner(admin))
                .submitMessage(submission, { value: totalFee }))
                .to.emit(protocolCoordinator, "MessageSubmissionInitiated");
        });

        it("Should revert with insufficient fee", async function () {
            const { admin, user } = await getNamedAccounts();
            const submission = {
                messageType: testMessageType,
                target: user,
                targetChain: 1,
                payload: testPayload,
                settlementData: {
                    sourceToken: ethers.ZeroAddress,
                    targetToken: ethers.ZeroAddress,
                    amount: 0n,
                    recipient: user
                }
            };

            await expect(protocolCoordinator.connect(await ethers.getSigner(admin))
                .submitMessage(submission, { value: 0 }))
                .to.be.revertedWith("Insufficient fee");
        });
    });

    describe("Message Status Management", function () {
        let messageId: string;

        beforeEach(async function () {
            const { admin, user } = await getNamedAccounts();
            const submission = {
                messageType: testMessageType,
                target: user,
                targetChain: 1,
                payload: testPayload,
                settlementData: {
                    sourceToken: ethers.ZeroAddress,
                    targetToken: ethers.ZeroAddress,
                    amount: 0n,
                    recipient: user
                }
            };

            const [baseFee, deliveryFee, settlementFee] = await protocolCoordinator.quoteMessageFee(submission);
            const totalFee = baseFee + deliveryFee + settlementFee;

            // Fix for getEventTopic error
            const tx = await protocolCoordinator.connect(await ethers.getSigner(admin))
                .submitMessage(submission, { value: totalFee });
            const receipt = await tx.wait();
            // Get event from logs using event signature instead
            const eventSignature = "MessageSubmissionInitiated(bytes32,address,bytes32,address,uint16)";
            const event = receipt?.logs.find(log =>
                log.topics[0] === ethers.id(eventSignature)
            );
            messageId = event?.topics[1] as string;
        });
        it("Should return correct message status", async function () {
            const [processingStatus, settlementId, settlementStatus] = await protocolCoordinator.getMessageStatus(messageId);
            expect(processingStatus).to.equal(MessageStatus.PENDING);
            expect(settlementId).to.equal(ethers.ZeroHash);
            expect(settlementStatus).to.equal(0);
        });

        it("Should allow message retry", async function () {
            const { admin } = await getNamedAccounts();
            await expect(protocolCoordinator.connect(await ethers.getSigner(admin))
                .retryMessage(messageId, { value: ethers.parseEther("0.15") }))
                .to.emit(protocolCoordinator, "MessageRetryInitiated");
        });
    });

    describe("Administrative Functions", function () {
        it("Should update protocol components", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);

            const newRegistry = await ethers.deployContract("MockMessageRegistry");

            // Use exactly what the contract uses: keccak256("REGISTRY")
            const componentName = ethers.keccak256(ethers.toUtf8Bytes("REGISTRY"));

            await expect(protocolCoordinator.connect(adminSigner)
                .updateProtocolComponent(componentName, await newRegistry.getAddress()))
                .to.emit(protocolCoordinator, "ComponentUpdated");

            expect(await protocolCoordinator.messageRegistry()).to.equal(await newRegistry.getAddress());
        });

        // We should also test other components
        it("Should update all protocol components", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);

            // Test each component
            const components = ["REGISTRY", "PROTOCOL", "ROUTER", "PROCESSOR", "SETTLEMENT"];
            const mockContracts = {
                "REGISTRY": "MockMessageRegistry",
                "PROTOCOL": "MockMessageProtocol",
                "ROUTER": "MockMessageRouter",
                "PROCESSOR": "MockMessageProcessor",
                "SETTLEMENT": "MockSettlementController"
            };

            for (const component of components) {
                const newMock = await ethers.deployContract(mockContracts[component]);
                const componentHash = ethers.keccak256(ethers.toUtf8Bytes(component));

                await expect(protocolCoordinator.connect(adminSigner)
                    .updateProtocolComponent(componentHash, await newMock.getAddress()))
                    .to.emit(protocolCoordinator, "ComponentUpdated");
            }
        });

        // Test invalid cases
        it("Should revert for zero address", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);
            const componentName = ethers.keccak256(ethers.toUtf8Bytes("REGISTRY"));

            await expect(protocolCoordinator.connect(adminSigner)
                .updateProtocolComponent(componentName, ethers.ZeroAddress))
                .to.be.revertedWith("Invalid address");
        });

        it("Should revert for invalid component", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);

            // Use a real address but invalid component name
            const dummyAddress = await (await ethers.deployContract("MockMessageRegistry")).getAddress();
            const invalidComponentHash = ethers.keccak256(ethers.toUtf8Bytes("INVALID"));

            await expect(protocolCoordinator.connect(adminSigner)
                .updateProtocolComponent(invalidComponentHash, dummyAddress))
                .to.be.revertedWith("Invalid component");
        });


        it("Should update base fee", async function () {
            const { admin } = await getNamedAccounts();
            const newBaseFee = ethers.parseEther("0.002");

            await expect(protocolCoordinator.connect(await ethers.getSigner(admin))
                .updateBaseFee(newBaseFee))
                .to.emit(protocolCoordinator, "FeeUpdated")
                .withArgs(newBaseFee);

            expect(await protocolCoordinator.baseFee()).to.equal(newBaseFee);
        });

        it("Should handle emergency message cancellation", async function () {
            const { emergencyAdmin } = await getNamedAccounts();
            const emergencySigner = await ethers.getSigner(emergencyAdmin);

            await expect(protocolCoordinator.connect(emergencySigner)
                .emergencyCancelMessage(ethers.randomBytes(32)))
                .to.be.revertedWith("Message not found");
        });
    });

    describe("Edge Cases and Validations", function () {
        /* it("Should handle maximum size messages", async function () {
            const { admin, user } = await getNamedAccounts();
            const largePayload = new Uint8Array(1024 * 1024).fill(0); // 1MB of zeros

            const submission = {
                messageType: testMessageType,
                target: user,
                targetChain: 1,
                payload: largePayload,
                settlementData: {
                    sourceToken: ethers.ZeroAddress,
                    targetToken: ethers.ZeroAddress,
                    amount: 0n,
                    recipient: user
                }
            };

            const [baseFee, deliveryFee, settlementFee] = await protocolCoordinator.quoteMessageFee(submission);
            const totalFee = baseFee + deliveryFee + settlementFee;

            await expect(protocolCoordinator.connect(await ethers.getSigner(admin))
                .submitMessage(submission, { value: totalFee }))
                .to.not.be.reverted;
        }); */

        it("Should revert on oversized messages", async function () {
            const { admin, user } = await getNamedAccounts();
            const overSizedPayload = new Uint8Array(1024 * 1024 + 1).fill(0);

            const submission = {
                messageType: testMessageType,
                target: user,
                targetChain: 1,
                payload: overSizedPayload,
                settlementData: {
                    sourceToken: ethers.ZeroAddress,
                    targetToken: ethers.ZeroAddress,
                    amount: 0n,
                    recipient: user
                }
            };

            const [baseFee, deliveryFee, settlementFee] = await protocolCoordinator.quoteMessageFee(submission);
            const totalFee = baseFee + deliveryFee + settlementFee;

            await expect(protocolCoordinator.connect(await ethers.getSigner(admin))
                .submitMessage(submission, { value: totalFee }))
                .to.be.revertedWith("Payload too large");
        });
    });
});