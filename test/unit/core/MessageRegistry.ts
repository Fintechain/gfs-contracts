import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { IMessageRegistry, MessageRegistry } from "../../../typechain";

enum MessageStatus {
    PENDING,
    DELIVERED,
    PROCESSED,
    FAILED,
    SETTLED,
    CANCELLED
}

describe("MessageRegistry", function () {
    let messageRegistry: MessageRegistry;
    const testMessageType = ethers.encodeBytes32String("TEST_MESSAGE");
    const testMessageHash = ethers.keccak256(ethers.toUtf8Bytes("test-message"));
    const testPayload = ethers.toUtf8Bytes("test-payload");
    let registrar: string, processor: string, user: string;

    beforeEach(async function () {
        await deployments.fixture(['MessageRegistry']);

        const { admin } = await getNamedAccounts();
        const signers = await ethers.getSigners();
        // Validate that there are enough signers for testing
        if (signers.length < 4) {
            throw new Error("Not enough accounts available. At least 3 are required for testing.");
        }

        registrar = signers[2].address;
        processor = signers[3].address;
        user = signers[4].address;

        const MessageRegistryDeployment = await deployments.get('MessageRegistry');
        messageRegistry = await ethers.getContractAt('MessageRegistry', MessageRegistryDeployment.address);

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
            expect(await messageRegistry.hasRole(await messageRegistry.REGISTRAR_ROLE(), registrar)).to.be.true;
            expect(await messageRegistry.hasRole(await messageRegistry.PROCESSOR_ROLE(), processor)).to.be.true;
        });
    });

    describe("Message Registration", function () {
        it("Should allow registrar to register message", async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            
            const expectedMessageId = await messageRegistry.generateMessageId(
                testMessageType,
                testMessageHash,
                registrar,
                user,
                1
            );

            await expect(messageRegistry.connect(registrarSigner)
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload))
                .to.emit(messageRegistry, "MessageRegistered")
                .withArgs(expectedMessageId, testMessageType, registrar, user, 1);
        });

        it("Should store correct message data", async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            
            const expectedMessageId = await messageRegistry.generateMessageId(
                testMessageType,
                testMessageHash,
                registrar,
                user,
                1
            );
            
            await expect(messageRegistry.connect(registrarSigner)
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload))
                .to.emit(messageRegistry, "MessageRegistered")
                .withArgs(expectedMessageId, testMessageType, registrar, user, 1);

            const message = await messageRegistry.getMessage(expectedMessageId);
            expect(message.messageType).to.equal(testMessageType);
            expect(message.messageHash).to.equal(testMessageHash);
            expect(message.target).to.equal(user);
            expect(message.targetChain).to.equal(1);
        });

        it("Should revert if non-registrar tries to register", async function () {
            await expect(messageRegistry.connect(await ethers.getSigner(user))
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload))
                .to.be.revertedWith("MessageRegistry: Must have registrar role");
        });

        it("Should revert with zero address target", async function () {
            await expect(messageRegistry.connect(await ethers.getSigner(registrar))
                .registerMessage(testMessageType, testMessageHash, ethers.ZeroAddress, 1, testPayload))
                .to.be.revertedWith("MessageRegistry: Invalid target address");
        });

        it("Should revert with empty payload", async function () {
            await expect(messageRegistry.connect(await ethers.getSigner(registrar))
                .registerMessage(testMessageType, testMessageHash, user, 1, "0x"))
                .to.be.revertedWith("MessageRegistry: Empty payload");
        });
    });

    describe("Message Status Management", function () {
        let messageId: string;

        beforeEach(async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            
            messageId = await messageRegistry.generateMessageId(
                testMessageType,
                testMessageHash,
                registrar,
                user,
                1
            );

            await expect(messageRegistry.connect(registrarSigner)
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload))
                .to.emit(messageRegistry, "MessageRegistered")
                .withArgs(messageId, testMessageType, registrar, user, 1);
        });

        it("Should allow processor to update status", async function () {
            await expect(messageRegistry.connect(await ethers.getSigner(processor))
                .updateMessageStatus(messageId, MessageStatus.DELIVERED))
                .to.emit(messageRegistry, "MessageStatusUpdated")
                .withArgs(messageId, MessageStatus.PENDING, MessageStatus.DELIVERED);
        });

        it("Should follow valid status transitions", async function () {
            const processorSigner = await ethers.getSigner(processor);

            await messageRegistry.connect(processorSigner).updateMessageStatus(messageId, MessageStatus.DELIVERED);
            await messageRegistry.connect(processorSigner).updateMessageStatus(messageId, MessageStatus.PROCESSED);
            await messageRegistry.connect(processorSigner).updateMessageStatus(messageId, MessageStatus.SETTLED);

            const finalStatus = await messageRegistry.getMessageStatus(messageId);
            expect(finalStatus).to.equal(MessageStatus.SETTLED);
        });

        it("Should revert invalid status transitions", async function () {
            await expect(messageRegistry.connect(await ethers.getSigner(processor))
                .updateMessageStatus(messageId, MessageStatus.SETTLED))
                .to.be.revertedWith("MessageRegistry: Invalid status transition");
        });
    });

    describe("Message Queries", function () {
        let messageId: string;
        let secondMessageId: string;

        beforeEach(async function () {
            const registrarSigner = await ethers.getSigner(registrar);

            messageId = await messageRegistry.generateMessageId(
                testMessageType,
                testMessageHash,
                registrar,
                user,
                1
            );

            const secondMessageHash = ethers.keccak256(ethers.toUtf8Bytes("test-message-2"));
            secondMessageId = await messageRegistry.generateMessageId(
                testMessageType,
                secondMessageHash,
                registrar,
                user,
                1
            );

            await expect(messageRegistry.connect(registrarSigner)
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload))
                .to.emit(messageRegistry, "MessageRegistered")
                .withArgs(messageId, testMessageType, registrar, user, 1);

            await expect(messageRegistry.connect(registrarSigner)
                .registerMessage(testMessageType, secondMessageHash, user, 1, testPayload))
                .to.emit(messageRegistry, "MessageRegistered")
                .withArgs(secondMessageId, testMessageType, registrar, user, 1);
        });

        it("Should return correct sender messages", async function () {
            const senderMessages = await messageRegistry.getMessagesBySender(registrar);
            expect(senderMessages).to.have.lengthOf(2);
            expect(senderMessages).to.include(messageId);
            expect(senderMessages).to.include(secondMessageId);
        });

        it("Should return correct target messages", async function () {
            const targetMessages = await messageRegistry.getMessagesByTarget(user);
            expect(targetMessages).to.have.lengthOf(2);
            expect(targetMessages).to.include(messageId);
            expect(targetMessages).to.include(secondMessageId);
        });

        it("Should correctly check message existence", async function () {
            // messageId is already defined and message registered in beforeEach
            expect(await messageRegistry.messageExists(messageId)).to.be.true;
            
            // Just check non-existent message
            const nonExistentMessageId = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));
            expect(await messageRegistry.messageExists(nonExistentMessageId)).to.be.false;
        });

        it("Should return correct message details", async function () {
            const message = await messageRegistry.getMessage(messageId);

            expect(message.messageType).to.equal(testMessageType);
            expect(message.messageHash).to.equal(testMessageHash);
            expect(message.sender).to.equal(registrar);
            expect(message.target).to.equal(user);
            expect(message.targetChain).to.equal(1);
            expect(message.status).to.equal(MessageStatus.PENDING);
            expect(message.payload).to.equal(ethers.hexlify(testPayload));
        });
    });

    describe("Admin Functions", function () {
        let messageId: string;

        beforeEach(async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            
            messageId = await messageRegistry.generateMessageId(
                testMessageType,
                testMessageHash,
                registrar,
                user,
                1
            );

            await expect(messageRegistry.connect(registrarSigner)
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload))
                .to.emit(messageRegistry, "MessageRegistered")
                .withArgs(messageId, testMessageType, registrar, user, 1);
        });

        it("Should allow admin to clear sender message index", async function () {
            const { admin } = await getNamedAccounts();

            await expect(messageRegistry.connect(await ethers.getSigner(admin))
                .clearMessageIndex(registrar, true))
                .to.emit(messageRegistry, "IndexCleared")
                .withArgs(registrar, true);

            const messages = await messageRegistry.getMessagesBySender(registrar);
            expect(messages).to.have.lengthOf(0);
        });

        it("Should allow admin to clear target message index", async function () {
            const { admin } = await getNamedAccounts();

            await expect(messageRegistry.connect(await ethers.getSigner(admin))
                .clearMessageIndex(user, false))
                .to.emit(messageRegistry, "IndexCleared")
                .withArgs(user, false);

            const messages = await messageRegistry.getMessagesByTarget(user);
            expect(messages).to.have.lengthOf(0);
        });

        it("Should allow admin to pause and unpause", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);
            const registrarSigner = await ethers.getSigner(registrar);
        
            // First attempt with original hash
            const messageId1 = await messageRegistry.generateMessageId(
                testMessageType,
                testMessageHash,
                registrar,
                user,
                1
            );
        
            // Generate a different hash for second attempt
            const secondMessageHash = ethers.keccak256(ethers.toUtf8Bytes("test-message-pause"));
            const messageId2 = await messageRegistry.generateMessageId(
                testMessageType,
                secondMessageHash,
                registrar,
                user,
                1
            );
        
            await messageRegistry.connect(adminSigner).pause();
        
            await expect(messageRegistry.connect(registrarSigner)
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload))
                .to.be.revertedWithCustomError(messageRegistry, "EnforcedPause");
        
            await messageRegistry.connect(adminSigner).unpause();
        
            // Use different message hash for second registration
            await expect(messageRegistry.connect(registrarSigner)
                .registerMessage(testMessageType, secondMessageHash, user, 1, testPayload))
                .to.emit(messageRegistry, "MessageRegistered")
                .withArgs(messageId2, testMessageType, registrar, user, 1);
        });

        it("Should revert admin functions for non-admin", async function () {
            const userSigner = await ethers.getSigner(user);

            await expect(messageRegistry.connect(userSigner).pause())
                .to.be.revertedWith("MessageRegistry: Must have admin role");

            await expect(messageRegistry.connect(userSigner).unpause())
                .to.be.revertedWith("MessageRegistry: Must have admin role");

            await expect(messageRegistry.connect(userSigner).clearMessageIndex(user, true))
                .to.be.revertedWith("MessageRegistry: Must have admin role");
        });
    });

    describe("Message ID Generation", function () {
        it("Should generate consistent message IDs", async function () {
            const messageId = await messageRegistry.generateMessageId(
                testMessageType,
                testMessageHash,
                registrar,
                user,
                1
            );

            const secondId = await messageRegistry.generateMessageId(
                testMessageType,
                testMessageHash,
                registrar,
                user,
                1
            );
            expect(messageId).to.equal(secondId);

            const differentId = await messageRegistry.generateMessageId(
                testMessageType,
                testMessageHash,
                registrar,
                user,
                2
            );
            expect(messageId).to.not.equal(differentId);
        });
    });

    describe("Message Processing Status", function () {
        let messageId: string;

        beforeEach(async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            
            messageId = await messageRegistry.generateMessageId(
                testMessageType,
                testMessageHash,
                registrar,
                user,
                1
            );

            await expect(messageRegistry.connect(registrarSigner)
                .registerMessage(testMessageType, testMessageHash, user, 1, testPayload))
                .to.emit(messageRegistry, "MessageRegistered")
                .withArgs(messageId, testMessageType, registrar, user, 1);
        });

        it("Should track processed status correctly", async function () {
            const processorSigner = await ethers.getSigner(processor);

            expect(await messageRegistry.isMessageProcessed(messageId)).to.be.false;

            await messageRegistry.connect(processorSigner)
                .updateMessageStatus(messageId, MessageStatus.DELIVERED);
            await messageRegistry.connect(processorSigner)
                .updateMessageStatus(messageId, MessageStatus.PROCESSED);

            expect(await messageRegistry.isMessageProcessed(messageId)).to.be.true;
        });

        it("Should track settled status correctly", async function () {
            const processorSigner = await ethers.getSigner(processor);

            await messageRegistry.connect(processorSigner)
                .updateMessageStatus(messageId, MessageStatus.DELIVERED);
            await messageRegistry.connect(processorSigner)
                .updateMessageStatus(messageId, MessageStatus.PROCESSED);
            await messageRegistry.connect(processorSigner)
                .updateMessageStatus(messageId, MessageStatus.SETTLED);

                expect(await messageRegistry.isMessageProcessed(messageId)).to.be.true;
            });
    
            it("Should maintain processed status after failure", async function () {
                const processorSigner = await ethers.getSigner(processor);
    
                await messageRegistry.connect(processorSigner)
                    .updateMessageStatus(messageId, MessageStatus.DELIVERED);
                await messageRegistry.connect(processorSigner)
                    .updateMessageStatus(messageId, MessageStatus.PROCESSED);
    
                await expect(messageRegistry.connect(processorSigner)
                    .updateMessageStatus(messageId, MessageStatus.FAILED))
                    .to.be.revertedWith("MessageRegistry: Invalid status transition");
    
                expect(await messageRegistry.isMessageProcessed(messageId)).to.be.true;
            });
        });
    
        describe("Status Transitions", function () {
            let messageId: string;
    
            beforeEach(async function () {
                const registrarSigner = await ethers.getSigner(registrar);
                
                messageId = await messageRegistry.generateMessageId(
                    testMessageType,
                    testMessageHash,
                    registrar,
                    user,
                    1
                );
    
                await expect(messageRegistry.connect(registrarSigner)
                    .registerMessage(testMessageType, testMessageHash, user, 1, testPayload))
                    .to.emit(messageRegistry, "MessageRegistered")
                    .withArgs(messageId, testMessageType, registrar, user, 1);
            });
    
            it("Should allow all valid status transitions", async function () {
                const processorSigner = await ethers.getSigner(processor);
    
                await expect(messageRegistry.connect(processorSigner)
                    .updateMessageStatus(messageId, MessageStatus.DELIVERED))
                    .to.emit(messageRegistry, "MessageStatusUpdated")
                    .withArgs(messageId, MessageStatus.PENDING, MessageStatus.DELIVERED);
    
                await expect(messageRegistry.connect(processorSigner)
                    .updateMessageStatus(messageId, MessageStatus.PROCESSED))
                    .to.emit(messageRegistry, "MessageStatusUpdated")
                    .withArgs(messageId, MessageStatus.DELIVERED, MessageStatus.PROCESSED);
    
                await expect(messageRegistry.connect(processorSigner)
                    .updateMessageStatus(messageId, MessageStatus.SETTLED))
                    .to.emit(messageRegistry, "MessageStatusUpdated")
                    .withArgs(messageId, MessageStatus.PROCESSED, MessageStatus.SETTLED);
            });
    
            it("Should allow transition to FAILED from PENDING", async function () {
                await expect(messageRegistry.connect(await ethers.getSigner(processor))
                    .updateMessageStatus(messageId, MessageStatus.FAILED))
                    .to.emit(messageRegistry, "MessageStatusUpdated")
                    .withArgs(messageId, MessageStatus.PENDING, MessageStatus.FAILED);
            });
    
            it("Should allow transition to FAILED from DELIVERED", async function () {
                const processorSigner = await ethers.getSigner(processor);
    
                await messageRegistry.connect(processorSigner)
                    .updateMessageStatus(messageId, MessageStatus.DELIVERED);
    
                await expect(messageRegistry.connect(processorSigner)
                    .updateMessageStatus(messageId, MessageStatus.FAILED))
                    .to.emit(messageRegistry, "MessageStatusUpdated")
                    .withArgs(messageId, MessageStatus.DELIVERED, MessageStatus.FAILED);
            });
        });
    
        describe("Edge Cases", function () {
            it("Should handle maximum size payloads", async function () {
                const largePayload = ethers.toUtf8Bytes("x".repeat(24576)); // 24KB
    
                const messageId = await messageRegistry.generateMessageId(
                    testMessageType,
                    testMessageHash,
                    registrar,
                    user,
                    1
                );
    
                await expect(messageRegistry.connect(await ethers.getSigner(registrar))
                    .registerMessage(testMessageType, testMessageHash, user, 1, largePayload))
                    .to.emit(messageRegistry, "MessageRegistered")
                    .withArgs(messageId, testMessageType, registrar, user, 1);
            });
    
            it("Should handle different message types", async function () {
                const messageTypes = [
                    ethers.encodeBytes32String("PACS.008"),
                    ethers.encodeBytes32String("PACS.009"),
                    ethers.encodeBytes32String("PAIN.001")
                ];
    
                for (const msgType of messageTypes) {
                    const messageId = await messageRegistry.generateMessageId(
                        msgType,
                        testMessageHash,
                        registrar,
                        user,
                        1
                    );
    
                    await expect(messageRegistry.connect(await ethers.getSigner(registrar))
                        .registerMessage(msgType, testMessageHash, user, 1, testPayload))
                        .to.emit(messageRegistry, "MessageRegistered")
                        .withArgs(messageId, msgType, registrar, user, 1);
                }
            });
    
            it("Should handle concurrent messages to same target", async function () {
                const registrarSigner = await ethers.getSigner(registrar);
                const promises = [];
                const messageIds = [];
    
                // Generate messageIds first
                for (let i = 0; i < 5; i++) {
                    const uniqueHash = ethers.keccak256(ethers.toUtf8Bytes(`test-message-${i}`));
                    const messageId = await messageRegistry.generateMessageId(
                        testMessageType,
                        uniqueHash,
                        registrar,
                        user,
                        1
                    );
                    messageIds.push(messageId);
                    
                    promises.push(
                        expect(messageRegistry.connect(registrarSigner)
                            .registerMessage(testMessageType, uniqueHash, user, 1, testPayload))
                            .to.emit(messageRegistry, "MessageRegistered")
                            .withArgs(messageId, testMessageType, registrar, user, 1)
                    );
                }
    
                await Promise.all(promises);
    
                const targetMessages = await messageRegistry.getMessagesByTarget(user);
                expect(targetMessages).to.have.lengthOf(5);
                messageIds.forEach(id => expect(targetMessages).to.include(id));
            });
        });
    });