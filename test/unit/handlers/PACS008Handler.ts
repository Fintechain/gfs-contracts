import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { CreatePACS008Payload } from "../../../src/utils/message-helpers";

describe("PACS008Handler", function () {
    let pacs008Handler: any;
    let settlementController: any;
    let mockToken: any;

    const MESSAGE_TYPE_PACS008 = ethers.keccak256(ethers.toUtf8Bytes("pacs.008"));
    const MAXIMUM_AMOUNT = ethers.parseEther("1000000");  // 1 million
    const DUMMY_SETTLEMENT_ID = ethers.keccak256(ethers.toUtf8Bytes("settlement"));


    beforeEach(async function () {
        // Deploy all contracts using fixture
        await deployments.fixture(['PACS008Handler']);

        const { admin } = await getNamedAccounts();

        // Get deployed contract instances
        const mockTokenDeployment = await deployments.get('MockERC20Token');
        const mockSettlementControllerDeployment = await deployments.get('MockSettlementController');
        const pacs008HandlerDeployment = await deployments.get('PACS008Handler');

        // Get contract instances
        mockToken = await ethers.getContractAt('MockERC20Token', mockTokenDeployment.address);
        settlementController = await ethers.getContractAt('MockSettlementController', mockSettlementControllerDeployment.address);
        pacs008Handler = await ethers.getContractAt('PACS008Handler', pacs008HandlerDeployment.address);

        // Configure mock settlement controller
        await settlementController.setMockSettlementId(DUMMY_SETTLEMENT_ID);

        // Setup processor role if not already set in deploy script
        const processorRole = await pacs008Handler.PROCESSOR_ROLE();
        if (!(await pacs008Handler.hasRole(processorRole, admin))) {
            await pacs008Handler.grantRole(processorRole, admin);
        }
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await pacs008Handler.hasRole(await pacs008Handler.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
        });

        it("Should initialize with correct settlement controller", async function () {
            expect(await pacs008Handler.settlementController()).to.equal(await settlementController.getAddress());
        });

        it("Should support PACS.008 message type", async function () {
            const supportedTypes = await pacs008Handler.getSupportedMessageTypes();
            expect(supportedTypes).to.have.lengthOf(1);
            expect(supportedTypes[0]).to.equal(MESSAGE_TYPE_PACS008);
        });
    });

    describe("Message Processing", function () {
        it("Should process valid message successfully", async function () {
            const { admin } = await getNamedAccounts();
            const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message"));
            const debtorAgent = ethers.Wallet.createRandom().address;
            const creditorAgent = ethers.Wallet.createRandom().address;
            const amount = ethers.parseEther("1000");

            const payload = CreatePACS008Payload(
                debtorAgent,
                creditorAgent,
                await mockToken.getAddress(),
                amount,
                ethers.hexlify(ethers.randomBytes(32))
            );
            
            const tx = await pacs008Handler.connect(await ethers.getSigner(admin))
                .handleMessage(messageId, payload);

            await expect(tx)
                .to.emit(pacs008Handler, "CreditTransferProcessed")
                .withArgs(
                    messageId,
                    DUMMY_SETTLEMENT_ID,
                    debtorAgent,
                    creditorAgent,
                    await mockToken.getAddress(),
                    amount
                );
        });

        it("Should reject invalid payload length", async function () {
            const { admin } = await getNamedAccounts();
            const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message"));
            const invalidPayload = ethers.toUtf8Bytes("invalid");

            await expect(
                pacs008Handler.connect(await ethers.getSigner(admin))
                    .handleMessage(messageId, invalidPayload)
            ).to.be.revertedWithCustomError(pacs008Handler, "InvalidPayloadLength");
        });

        it("Should reject zero addresses", async function () {
            const { admin } = await getNamedAccounts();
            const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message"));

            const payload = CreatePACS008Payload(
                ethers.ZeroAddress,
                ethers.ZeroAddress,
                await mockToken.getAddress(),
                ethers.parseEther("1000"),
                ethers.hexlify(ethers.randomBytes(32))
            );

            await expect(
                pacs008Handler.connect(await ethers.getSigner(admin))
                    .handleMessage(messageId, payload)
            ).to.be.revertedWithCustomError(pacs008Handler, "InvalidMessageFormat");
        });

        it("Should reject invalid amounts", async function () {
            const { admin } = await getNamedAccounts();
            const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message"));
            const debtorAgent = ethers.Wallet.createRandom().address;
            const creditorAgent = ethers.Wallet.createRandom().address;

            // Test amount below minimum
            const lowPayload = CreatePACS008Payload(
                debtorAgent,
                creditorAgent,
                await mockToken.getAddress(),
                0n,
                ethers.hexlify(ethers.randomBytes(32))
            );

            await expect(
                pacs008Handler.connect(await ethers.getSigner(admin))
                    .handleMessage(messageId, lowPayload)
            ).to.be.revertedWithCustomError(pacs008Handler, "InvalidAmount");

            // Test amount above maximum
            const highPayload = CreatePACS008Payload(
                debtorAgent,
                creditorAgent,
                await mockToken.getAddress(),
                MAXIMUM_AMOUNT + 1n,
                ethers.hexlify(ethers.randomBytes(32))
            );

            await expect(
                pacs008Handler.connect(await ethers.getSigner(admin))
                    .handleMessage(messageId, highPayload)
            ).to.be.revertedWithCustomError(pacs008Handler, "InvalidAmount");
        });

        it("Should reject duplicate messages", async function () {
            const { admin } = await getNamedAccounts();
            const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message"));
            const payload = CreatePACS008Payload(
                ethers.Wallet.createRandom().address,
                ethers.Wallet.createRandom().address,
                await mockToken.getAddress(),
                ethers.parseEther("1000"),
                ethers.hexlify(ethers.randomBytes(32))
            );
            // First processing should succeed
            await pacs008Handler.connect(await ethers.getSigner(admin))
                .handleMessage(messageId, payload);

            // Second processing should fail
            await expect(
                pacs008Handler.connect(await ethers.getSigner(admin))
                    .handleMessage(messageId, payload)
            ).to.be.revertedWith("Message already processed");
        });
    });

    describe("Access Control", function () {
        it("Should reject unauthorized processors", async function () {

            const { user } = await getNamedAccounts();

            const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message"));
            const payload = CreatePACS008Payload(
                ethers.Wallet.createRandom().address,
                ethers.Wallet.createRandom().address,
                await mockToken.getAddress(),
                ethers.parseEther("1000"),
                ethers.hexlify(ethers.randomBytes(32))
            );
            await expect(
                pacs008Handler.connect(await ethers.getSigner(user))
                    .handleMessage(messageId, payload)
            ).to.be.revertedWith("Unauthorized processor");
        });
    });

    describe("Emergency Controls", function () {
        it("Should allow admin to pause and unpause", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);
            const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message"));
            const payload = CreatePACS008Payload(
                ethers.Wallet.createRandom().address,
                ethers.Wallet.createRandom().address,
                await mockToken.getAddress(),
                ethers.parseEther("1000"),
                ethers.hexlify(ethers.randomBytes(32))
            );

            // Pause contract
            await pacs008Handler.connect(adminSigner).pause();
            expect(await pacs008Handler.paused()).to.be.true;

            // Verify operations are blocked
            await expect(
                pacs008Handler.connect(adminSigner)
                    .handleMessage(messageId, payload)
            ).to.be.revertedWithCustomError(pacs008Handler, "EnforcedPause");

            // Unpause and verify operations resume
            await pacs008Handler.connect(adminSigner).unpause();
            await expect(
                pacs008Handler.connect(adminSigner)
                    .handleMessage(messageId, payload)
            ).to.not.be.reverted;
        });

        it("Should prevent non-admin from pausing", async function () {
            const { user } = await getNamedAccounts();
            await expect(
                pacs008Handler.connect(await ethers.getSigner(user)).pause()
            ).to.be.revertedWith("Unauthorized");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle maximum allowed amount", async function () {
            const { admin } = await getNamedAccounts();
            const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message"));

            const payload = CreatePACS008Payload(
                ethers.Wallet.createRandom().address,
                ethers.Wallet.createRandom().address,
                await mockToken.getAddress(),
                MAXIMUM_AMOUNT,
                ethers.hexlify(ethers.randomBytes(32))
            );
            await expect(
                pacs008Handler.connect(await ethers.getSigner(admin))
                    .handleMessage(messageId, payload)
            ).to.not.be.reverted;
        });

        it("Should handle concurrent messages", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);
            const promises = [];

            for (let i = 0; i < 5; i++) {
                const messageId = ethers.keccak256(ethers.toUtf8Bytes(`test-message-${i}`));

                const payload = CreatePACS008Payload(
                    ethers.Wallet.createRandom().address,
                    ethers.Wallet.createRandom().address,
                    await mockToken.getAddress(),
                    ethers.parseEther("1000"),
                    ethers.keccak256(ethers.toUtf8Bytes(`instruction-${i}`))
                );

                promises.push(
                    pacs008Handler.connect(adminSigner)
                        .handleMessage(messageId, payload)
                );
            }

            await Promise.all(promises.map(p => expect(p).to.not.be.reverted));
        });
    });
});