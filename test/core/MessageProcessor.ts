import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { MessageProcessor, MockHandler } from "../../typechain";

describe("MessageProcessor", function () {
    let messageProcessor: MessageProcessor;
    const testMessageType = ethers.encodeBytes32String("TEST_MESSAGE");
    const testMessageId = ethers.encodeBytes32String("TEST_ID");
    const testPayload = ethers.toUtf8Bytes("test-payload");

    beforeEach(async function () {
        await deployments.fixture(['MessageProcessor']);

        const { admin, processor, msgHandlerAdmin } = await getNamedAccounts();

        const MessageProcessorDeployment = await deployments.get('MessageProcessor');
        messageProcessor = await ethers.getContractAt('MessageProcessor', MessageProcessorDeployment.address);

        // Grant roles
        const processorRole = await messageProcessor.PROCESSOR_ROLE();
        const handlerAdminRole = await messageProcessor.HANDLER_ADMIN_ROLE();

        await messageProcessor.connect(await ethers.getSigner(admin)).grantRole(processorRole, processor);
        await messageProcessor.connect(await ethers.getSigner(admin)).grantRole(handlerAdminRole, msgHandlerAdmin);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await messageProcessor.hasRole(await messageProcessor.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
        });

        it("Should set initial roles correctly", async function () {
            const { processor, msgHandlerAdmin } = await getNamedAccounts();
            expect(await messageProcessor.hasRole(await messageProcessor.PROCESSOR_ROLE(), processor)).to.be.true;
            expect(await messageProcessor.hasRole(await messageProcessor.HANDLER_ADMIN_ROLE(), msgHandlerAdmin)).to.be.true;
        });
    });

    describe("Handler Management", function () {
        it("Should allow handler admin to register handler", async function () {
            const { msgHandlerAdmin } = await getNamedAccounts();
            const mockHandler = ethers.Wallet.createRandom().address;

            await expect(messageProcessor.connect(await ethers.getSigner(msgHandlerAdmin))
                .registerMessageHandler(testMessageType, mockHandler))
                .to.emit(messageProcessor, "HandlerRegistered")
                .withArgs(testMessageType, mockHandler, msgHandlerAdmin);
        });

        it("Should store correct handler address", async function () {
            const { msgHandlerAdmin } = await getNamedAccounts();
            const mockHandler = ethers.Wallet.createRandom().address;

            await messageProcessor.connect(await ethers.getSigner(msgHandlerAdmin))
                .registerMessageHandler(testMessageType, mockHandler);

            expect(await messageProcessor.getHandler(testMessageType)).to.equal(mockHandler);
        });

        it("Should revert if non-admin tries to register handler", async function () {
            const { processor } = await getNamedAccounts();
            const mockHandler = ethers.Wallet.createRandom().address;

            await expect(messageProcessor.connect(await ethers.getSigner(processor))
                .registerMessageHandler(testMessageType, mockHandler))
                .to.be.revertedWith("MessageProcessor: Must have handler admin role");
        });
    });

    describe("Message Processing", function () {
        let mockHandler: string;

        beforeEach(async function () {
            const { msgHandlerAdmin } = await getNamedAccounts();

            // Deploy and configure mock handler
            const MockHandler = await ethers.getContractFactory("MockHandler");
            const handler = await MockHandler.deploy();
            mockHandler = await handler.getAddress();

            await messageProcessor.connect(await ethers.getSigner(msgHandlerAdmin))
                .registerMessageHandler(testMessageType, mockHandler);

            await messageProcessor.connect(await ethers.getSigner(msgHandlerAdmin))
                .setRequiredAction(testMessageType, 0); // NOTIFICATION_ONLY
        });

        it("Should process message successfully", async function () {
            const { processor } = await getNamedAccounts();
            const processorSigner = await ethers.getSigner(processor);

            // Process message and wait for transaction
            const tx = await messageProcessor.connect(processorSigner)
                .processMessage(testMessageId, testMessageType, testPayload);

            // Wait for the transaction and events
            await expect(tx)
                .to.emit(messageProcessor, "ProcessingStarted")
                .withArgs(testMessageId, testMessageType, 0) // 0 for NOTIFICATION_ONLY
                .to.emit(messageProcessor, "ProcessingCompleted")
                .withArgs(testMessageId, true, ethers.ZeroHash);  // true for success, zero hash for no settlement

            // Get the processing result using view function
            const result = await messageProcessor.getProcessingStatus(testMessageId);
            expect(result.success).to.be.true;
            expect(result.messageId).to.equal(testMessageId);
            expect(result.action).to.equal(0); // NOTIFICATION_ONLY
        });

        it("Should emit correct events", async function () {
            const { processor } = await getNamedAccounts();

            await expect(messageProcessor.connect(await ethers.getSigner(processor))
                .processMessage(testMessageId, testMessageType, testPayload))
                .to.emit(messageProcessor, "ProcessingStarted")
                .withArgs(testMessageId, testMessageType, 0)
                .to.emit(messageProcessor, "ProcessingCompleted")
                .withArgs(testMessageId, true, ethers.ZeroHash);
        });

        it("Should revert if message already processed", async function () {
            const { processor } = await getNamedAccounts();

            await messageProcessor.connect(await ethers.getSigner(processor))
                .processMessage(testMessageId, testMessageType, testPayload);

            await expect(messageProcessor.connect(await ethers.getSigner(processor))
                .processMessage(testMessageId, testMessageType, testPayload))
                .to.be.revertedWith("MessageProcessor: Message already processed");
        });
    });

    describe("Emergency Controls", function () {
        it("Should allow admin to pause", async function () {
            const { admin } = await getNamedAccounts();
            await messageProcessor.connect(await ethers.getSigner(admin)).pause();
            expect(await messageProcessor.paused()).to.be.true;
        });

        it("Should prevent operations when paused", async function () {
            const { admin, processor } = await getNamedAccounts();
            await messageProcessor.connect(await ethers.getSigner(admin)).pause();

            await expect(messageProcessor.connect(await ethers.getSigner(processor))
                .processMessage(testMessageId, testMessageType, testPayload))
                .to.be.reverted;
        });

        it("Should allow admin to unpause", async function () {
            const { admin } = await getNamedAccounts();
            await messageProcessor.connect(await ethers.getSigner(admin)).pause();
            await messageProcessor.connect(await ethers.getSigner(admin)).unpause();
            expect(await messageProcessor.paused()).to.be.false;
        });
    });
});