import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { MessageRegistry } from "../../typechain";

describe("MessageRegistry", function () {
    let messageRegistry: MessageRegistry;
    const testMessageType = ethers.encodeBytes32String("TEST_MESSAGE");
    const testMessageHash = ethers.keccak256(ethers.toUtf8Bytes("test-message"));
    const testPayload = ethers.toUtf8Bytes("test-payload");

    beforeEach(async function () {
        await deployments.fixture(['MessageRegistry']);

        const { admin, registrar, processor, user } = await getNamedAccounts();

        const MessageRegistryDeployment = await deployments.get('MessageRegistry');
        messageRegistry = await ethers.getContractAt('MessageRegistry', MessageRegistryDeployment.address);

        // Grant roles
        const registrarRole = await messageRegistry.REGISTRAR_ROLE();
        const processorRole = await messageRegistry.PROCESSOR_ROLE();

        await messageRegistry.connect(await ethers.getSigner(admin)).grantRole(registrarRole, registrar);
        await messageRegistry.connect(await ethers.getSigner(admin)).grantRole(processorRole, processor);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await messageRegistry.hasRole(await messageRegistry.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
        });

        it("Should set initial roles correctly", async function () {
            const { registrar, processor } = await getNamedAccounts();
            expect(await messageRegistry.hasRole(await messageRegistry.REGISTRAR_ROLE(), registrar)).to.be.true;
            expect(await messageRegistry.hasRole(await messageRegistry.PROCESSOR_ROLE(), processor)).to.be.true;
        });
    });

    describe("Message Registration", function () {
        it("Should allow registrar to register message", async function () {
            const { registrar, user } = await getNamedAccounts();
            await expect(messageRegistry.connect(await ethers.getSigner(registrar))
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload))
                .to.emit(messageRegistry, "MessageRegistered");
        });

        it("Should store correct message data", async function () {
            const { registrar, user } = await getNamedAccounts();
            const tx = await messageRegistry.connect(await ethers.getSigner(registrar))
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload);
            const receipt = await tx.wait();
            const event = receipt.events?.find(e => e.event === "MessageRegistered");
            const messageId = event?.args?.messageId;

            const message = await messageRegistry.getMessage(messageId);
            expect(message.messageType).to.equal(testMessageType);
            expect(message.messageHash).to.equal(testMessageHash);
            expect(message.target).to.equal(user);
            expect(message.targetChain).to.equal(1);
        });

        it("Should revert if non-registrar tries to register", async function () {
            const { user } = await getNamedAccounts();
            await expect(messageRegistry.connect(await ethers.getSigner(user))
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload))
                .to.be.revertedWith("MessageRegistry: Must have registrar role");
        });

        it("Should revert with zero address target", async function () {
            const { registrar } = await getNamedAccounts();
            await expect(messageRegistry.connect(await ethers.getSigner(registrar))
                .registerMessage(testMessageType, testMessageHash, ethers.ZeroAddress, 1, testPayload))
                .to.be.revertedWith("MessageRegistry: Invalid target address");
        });

        it("Should revert with empty payload", async function () {
            const { registrar, user } = await getNamedAccounts();
            await expect(messageRegistry.connect(await ethers.getSigner(registrar))
                .registerMessage(testMessageType, testMessageHash, user, 1, []))
                .to.be.revertedWith("MessageRegistry: Empty payload");
        });
    });

    describe("Message Status Management", function () {
        let messageId: string;

        beforeEach(async function () {
            const { registrar, user } = await getNamedAccounts();
            const tx = await messageRegistry.connect(await ethers.getSigner(registrar))
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload);
            const receipt = await tx.wait();
            const event = receipt.events?.find(e => e.event === "MessageRegistered");
            messageId = event?.args?.messageId;
        });

        it("Should allow processor to update status", async function () {
            const { processor } = await getNamedAccounts();
            await expect(messageRegistry.connect(await ethers.getSigner(processor))
                .updateMessageStatus(messageId, 1)) // MessageStatus.DELIVERED
                .to.emit(messageRegistry, "MessageStatusUpdated");
        });

        it("Should follow valid status transitions", async function () {
            const { processor } = await getNamedAccounts();
            const processorSigner = await ethers.getSigner(processor);

            // PENDING -> DELIVERED -> PROCESSED -> SETTLED
            await messageRegistry.connect(processorSigner).updateMessageStatus(messageId, 1); // DELIVERED
            await messageRegistry.connect(processorSigner).updateMessageStatus(messageId, 2); // PROCESSED
            await messageRegistry.connect(processorSigner).updateMessageStatus(messageId, 4); // SETTLED
            
            const finalStatus = await messageRegistry.getMessageStatus(messageId);
            expect(finalStatus).to.equal(4); // SETTLED
        });

        it("Should revert invalid status transitions", async function () {
            const { processor } = await getNamedAccounts();
            await expect(messageRegistry.connect(await ethers.getSigner(processor))
                .updateMessageStatus(messageId, 4)) // Try PENDING -> SETTLED
                .to.be.revertedWith("MessageRegistry: Invalid status transition");
        });
    });

    describe("Message Queries", function () {
        let messageId: string;

        beforeEach(async function () {
            const { registrar, user } = await getNamedAccounts();
            const tx = await messageRegistry.connect(await ethers.getSigner(registrar))
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload);
            const receipt = await tx.wait();
            const event = receipt.events?.find(e => e.event === "MessageRegistered");
            messageId = event?.args?.messageId;
        });

        it("Should return correct sender messages", async function () {
            const { registrar } = await getNamedAccounts();
            const