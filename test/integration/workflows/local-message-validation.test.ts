import { expect } from "chai";
import { ethers } from "hardhat";
import {
    ProtocolCoordinator,
    MessageRegistry,
    MessageProtocol,
    MessageRouter,
    MessageProcessor,
    PACS008Handler,
    SettlementController,
} from "../../../typechain";
import { deployContractsFixture } from "./fixture";
import { PACS008MessageServiceImpl } from "../../../src/services/pacs008-message.service";
import {
    TEST_CONSTANTS,
    createMessageData,
    generateInstructionId
} from "../../helpers/pacs008.helper";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MessageSubmissionError, MessageValidationError } from "../../../src/types/message-service";

describe("PACS008 Message Validation Tests", function () {
    let contracts: {
        protocolCoordinator: ProtocolCoordinator;
        messageRegistry: MessageRegistry;
        messageProtocol: MessageProtocol;
        messageRouter: MessageRouter;
        messageProcessor: MessageProcessor;
        messageHandler: PACS008Handler;
        settlementController: SettlementController;
    };

    let admin: SignerWithAddress;
    let sender: SignerWithAddress;
    let receiver: SignerWithAddress;
    let handlerAddress: string;
    let msgService: PACS008MessageServiceImpl;

    beforeEach(async function () {
        contracts = await deployContractsFixture();
        const signers = await ethers.getSigners();
        [admin, sender, receiver] = signers;
        handlerAddress = await contracts.messageHandler.getAddress();
        msgService = new PACS008MessageServiceImpl(
            contracts.protocolCoordinator,
            TEST_CONSTANTS.LOCAL_CHAIN_ID
        );
    });

    // Helper function to check for error messages in both direct and wrapped errors
    async function expectThrowsWithMessage(
        promise: Promise<any>,
        expectedMessage: string
    ) {
        try {
            await promise;
            expect.fail("Expected promise to throw");
        } catch (error: any) {
            if (error instanceof MessageValidationError) {
                expect(error.message).to.include(expectedMessage);
            } else if (error instanceof MessageSubmissionError) {
                const cause = error.cause as Error;
                expect(cause.message).to.include(expectedMessage);
            } else {
                expect(error.message).to.include(expectedMessage);
            }
        }
    }

    describe("Instruction ID Validation", function () {
        it("Should reject messages with empty instruction IDs", async function () {
            const messageData = {
                debtorAddr: sender.address,
                creditorAddr: receiver.address,
                tokenAddr: ethers.Wallet.createRandom().address,
                amount: ethers.parseEther("1"),
                instructionId: "", // Empty ID
                handlerAddr: handlerAddress
            };

            await expectThrowsWithMessage(
                msgService.submitMessage(messageData, admin),
                "Instruction ID is required"
            );
        });

        it("Should reject messages with oversized instruction IDs", async function () {
            const messageData = {
                debtorAddr: sender.address,
                creditorAddr: receiver.address,
                tokenAddr: ethers.Wallet.createRandom().address,
                amount: ethers.parseEther("1"),
                instructionId: "x".repeat(33), // 33 characters (max is 32)
                handlerAddr: handlerAddress
            };

            await expectThrowsWithMessage(
                msgService.submitMessage(messageData, admin),
                "Instruction ID exceeds maximum length"
            );
        });

        it("Should reject messages with invalid instruction ID characters", async function () {
            const messageData = {
                debtorAddr: sender.address,
                creditorAddr: receiver.address,
                tokenAddr: ethers.Wallet.createRandom().address,
                amount: ethers.parseEther("1"),
                instructionId: "Invalid@#$Characters",
                handlerAddr: handlerAddress
            };

            await expectThrowsWithMessage(
                msgService.submitMessage(messageData, admin),
                "Instruction ID contains invalid characters"
            );
        });
    });

    describe("Amount Validation", function () {
        it("Should reject messages with zero amounts", async function () {
            const messageData = await createMessageData(
                0n,
                sender.address,
                receiver.address,
                handlerAddress
            );

            await expectThrowsWithMessage(
                msgService.submitMessage(messageData, admin),
                "Amount must be positive"
            );
        });

        it("Should reject messages with amounts below minimum", async function () {
            const belowMin = TEST_CONSTANTS.MINIMUM_AMOUNT - 1n;
            const messageData = await createMessageData(
                belowMin,
                sender.address,
                receiver.address,
                handlerAddress
            );

            await expectThrowsWithMessage(
                msgService.submitMessage(messageData, admin),
                "Amount below minimum"
            );
        });

        /* it("Should reject messages with amounts above maximum", async function () {
            const aboveMax = TEST_CONSTANTS.MAXIMUM_AMOUNT + 1n;
            const messageData = await createMessageData(
                aboveMax,
                sender.address,
                receiver.address,
                handlerAddress
            );

            await expectThrowsWithMessage(
                msgService.submitMessage(messageData, admin),
                "Amount exceeds maximum"
            );
        }); */
    });

    describe("Address Validation", function () {
        it("Should reject messages where debtor and creditor are the same", async function () {
            const messageData = {
                debtorAddr: sender.address,
                creditorAddr: sender.address, // Same as debtor
                tokenAddr: ethers.Wallet.createRandom().address,
                amount: ethers.parseEther("1"),
                instructionId: generateInstructionId(),
                handlerAddr: handlerAddress
            };

            await expectThrowsWithMessage(
                msgService.submitMessage(messageData, admin),
                "Debtor and creditor cannot be the same address"
            );
        });

        it("Should reject messages with invalid token addresses", async function () {
            const messageData = {
                debtorAddr: sender.address,
                creditorAddr: receiver.address,
                tokenAddr: "0xinvalid", // Invalid address
                amount: ethers.parseEther("1"),
                instructionId: generateInstructionId(),
                handlerAddr: handlerAddress
            };

            await expectThrowsWithMessage(
                msgService.submitMessage(messageData, admin),
                "Invalid token address format"
            );
        });

        /* it("Should reject messages with zero addresses", async function () {
            const messageData = {
                debtorAddr: sender.address,
                creditorAddr: receiver.address,
                tokenAddr: ethers.ZeroAddress,
                amount: ethers.parseEther("1"),
                instructionId: generateInstructionId(),
                handlerAddr: handlerAddress
            };

            await expectThrowsWithMessage(
                msgService.submitMessage(messageData, admin),
                "Invalid token address"
            );
        }); */

        it("Should validate handler addresses correctly", async function () {
            const invalidHandler = ethers.Wallet.createRandom().address;
            const messageData = await createMessageData(
                ethers.parseEther("1"),
                sender.address,
                receiver.address,
                invalidHandler
            );

            await expectThrowsWithMessage(
                msgService.submitMessage(messageData, admin),
                "Invalid target"
            );
        });
    });

    describe("Duplicate Message Prevention", function () {
        it("Should prevent duplicate message processing", async function () {
            // Create initial message
            const messageData = await createMessageData(
                ethers.parseEther("1"),
                sender.address,
                receiver.address,
                handlerAddress
            );

            // Submit first message successfully
            await msgService.submitMessage(messageData, admin);

            // Attempt to submit the exact same message again
            await expectThrowsWithMessage(
                msgService.submitMessage(messageData, admin),
                "Message already exists"
            );
        });

        it("Should allow messages with same amounts but different IDs", async function () {
            const amount = ethers.parseEther("1");

            // First message
            const messageData1 = await createMessageData(
                amount,
                sender.address,
                receiver.address,
                handlerAddress
            );

            // Second message with same amount but different ID
            const messageData2 = await createMessageData(
                amount,
                sender.address,
                receiver.address,
                handlerAddress
            );

            // Both submissions should succeed
            await msgService.submitMessage(messageData1, admin);
            await expect(
                msgService.submitMessage(messageData2, admin)
            ).to.not.be.rejected;
        });
    });
});