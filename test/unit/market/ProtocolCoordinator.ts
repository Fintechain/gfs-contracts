import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { ProtocolCoordinator, MockMessageRegistry, MockMessageProtocol, MockMessageRouter, MockMessageProcessor } from "../../../typechain";

enum MessageStatus {
    PENDING,
    DELIVERED,
    PROCESSED,
    FAILED,
    CANCELLED
}

describe("ProtocolCoordinator", function () {
    let protocolCoordinator: ProtocolCoordinator;
    let messageRegistry: MockMessageRegistry;
    let messageProtocol: MockMessageProtocol;
    let messageRouter: MockMessageRouter;
    let messageProcessor: MockMessageProcessor;

    // Test values
    const testMessageType = ethers.encodeBytes32String("TEST_MESSAGE");
    const testPayload = ethers.toUtf8Bytes("test-payload");
    const testMessageHash = ethers.keccak256(testPayload);

    beforeEach(async function () {
        // Deploy all contracts fresh for each test
        await deployments.fixture(['ProtocolCoordinator']);

        const mockRegistryDeployment = await deployments.get('MockMessageRegistry');
        const mockProtocolDeployment = await deployments.get('MockMessageProtocol');
        const mockRouterDeployment = await deployments.get('MockMessageRouter');
        const mockProcessorDeployment = await deployments.get('MockMessageProcessor');

        messageRegistry = await ethers.getContractAt("MockMessageRegistry", mockRegistryDeployment.address);
        messageProtocol = await ethers.getContractAt("MockMessageProtocol", mockProtocolDeployment.address);
        messageRouter = await ethers.getContractAt("MockMessageRouter", mockRouterDeployment.address);
        messageProcessor = await ethers.getContractAt("MockMessageProcessor", mockProcessorDeployment.address);

        const protocolCoordinatorDeployment = await deployments.get('ProtocolCoordinator');
        protocolCoordinator = await ethers.getContractAt("ProtocolCoordinator", protocolCoordinatorDeployment.address);

        // Configure mocks
        await messageProtocol.setValidationResult(true);
        await messageRouter.setQuoteResult(ethers.parseEther("0.1"));
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
        });

        it("Should have correct initial configuration", async function () {
            expect(await protocolCoordinator.baseFee()).to.equal(ethers.parseEther("0.001"));
            expect(await protocolCoordinator.MAX_MESSAGE_SIZE()).to.equal(1024 * 1024); // 1MB
        });
    });

    describe("Message Submission", function () {
        it("Should submit message successfully", async function () {
            const { admin, user } = await getNamedAccounts();
            const submission = {
                messageType: testMessageType,
                target: user,
                targetChain: 1,
                payload: testPayload
            };

            const [baseFee, deliveryFee] = await protocolCoordinator.quoteMessageFee(submission);
            const totalFee = baseFee + deliveryFee;

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
                payload: testPayload
            };

            await expect(protocolCoordinator.connect(await ethers.getSigner(admin))
                .submitMessage(submission, { value: 0 }))
                .to.be.revertedWith("Insufficient fee");
        });
    });

    describe("Message Processing", function () {
        let messageId: string;

        beforeEach(async function () {
            const { admin, user } = await getNamedAccounts();
            const submission = {
                messageType: testMessageType,
                target: user,
                targetChain: 1,
                payload: testPayload
            };

            const [baseFee, deliveryFee] = await protocolCoordinator.quoteMessageFee(submission);
            const totalFee = baseFee + deliveryFee;

            const tx = await protocolCoordinator.connect(await ethers.getSigner(admin))
                .submitMessage(submission, { value: totalFee });
            const receipt = await tx.wait();
            const eventSignature = "MessageSubmissionInitiated(bytes32,address,bytes32,address,uint16)";
            const event = receipt?.logs.find(log =>
                log.topics[0] === ethers.id(eventSignature)
            );
            messageId = event?.topics[1] as string;
        });

        it("Should return correct message result", async function () {
            const [success, result] = await protocolCoordinator.getMessageResult(messageId);
            expect(success).to.be.false; // Initial state
            expect(result).to.equal("0x"); // No result yet
        });

        it("Should allow message retry", async function () {
            const { admin } = await getNamedAccounts();
            await expect(protocolCoordinator.connect(await ethers.getSigner(admin))
                .retryMessage(messageId, { value: ethers.parseEther("0.1") }))
                .to.emit(protocolCoordinator, "MessageRetryInitiated");
        });

        it("Should allow message cancellation", async function () {
            const { admin } = await getNamedAccounts();
            await expect(protocolCoordinator.connect(await ethers.getSigner(admin))
                .cancelMessage(messageId))
                .to.not.be.reverted;
        });
    });

    describe("Administrative Functions", function () {
        it("Should update protocol components", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);
            const newRegistry = await ethers.deployContract("MockMessageRegistry");
            const componentName = ethers.keccak256(ethers.toUtf8Bytes("REGISTRY"));

            await expect(protocolCoordinator.connect(adminSigner)
                .updateProtocolComponent(componentName, await newRegistry.getAddress()))
                .to.emit(protocolCoordinator, "ComponentUpdated");

            expect(await protocolCoordinator.messageRegistry()).to.equal(await newRegistry.getAddress());
        });

        it("Should update all protocol components", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);

            const components = ["REGISTRY", "PROTOCOL", "ROUTER", "PROCESSOR"];
            const mockContracts = {
                "REGISTRY": "MockMessageRegistry",
                "PROTOCOL": "MockMessageProtocol",
                "ROUTER": "MockMessageRouter",
                "PROCESSOR": "MockMessageProcessor"
            };

            for (const component of components) {
                const newMock = await ethers.deployContract(mockContracts[component]);
                const componentHash = ethers.keccak256(ethers.toUtf8Bytes(component));

                await expect(protocolCoordinator.connect(adminSigner)
                    .updateProtocolComponent(componentHash, await newMock.getAddress()))
                    .to.emit(protocolCoordinator, "ComponentUpdated");
            }
        });

        it("Should revert for zero address", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);
            const componentName = ethers.keccak256(ethers.toUtf8Bytes("REGISTRY"));

            await expect(protocolCoordinator.connect(adminSigner)
                .updateProtocolComponent(componentName, ethers.ZeroAddress))
                .to.be.revertedWith("Invalid address");
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
    });

    describe("Edge Cases and Validations", function () {
        it("Should revert on oversized messages", async function () {
            const { admin, user } = await getNamedAccounts();
            const overSizedPayload = new Uint8Array(1024 * 1024 + 1).fill(0);

            const submission = {
                messageType: testMessageType,
                target: user,
                targetChain: 1,
                payload: overSizedPayload
            };

            const [baseFee, deliveryFee] = await protocolCoordinator.quoteMessageFee(submission);
            const totalFee = baseFee + deliveryFee;

            await expect(protocolCoordinator.connect(await ethers.getSigner(admin))
                .submitMessage(submission, { value: totalFee }))
                .to.be.revertedWith("Payload too large");
        });

        it("Should handle emergency message cancellation", async function () {
            const { admin } = await getNamedAccounts();
            const emergencySigner = await ethers.getSigner(admin);

            await expect(protocolCoordinator.connect(emergencySigner)
                .emergencyCancelMessage(ethers.randomBytes(32)))
                .to.be.revertedWith("Message not found");
        });
    });
});