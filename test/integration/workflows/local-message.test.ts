import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";
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
    MessageSubmissionResponse,
    TransactionStatus,
    MessageSubmissionError
} from "../../../src/types/message-service";

/**
 * Test suite for end-to-end local message processing
 * Tests the complete flow of PACS008 message submission and processing
 */
describe("End-to-End Local Message Processing Debug", function () {
    let contracts: {
        protocolCoordinator: ProtocolCoordinator;
        messageRegistry: MessageRegistry;
        messageProtocol: MessageProtocol;
        messageRouter: MessageRouter;
        messageProcessor: MessageProcessor;
        messageHandler: PACS008Handler;
        settlementController: SettlementController;
    };

    // Test specific constants
    const EXPECTED_CONFIRMATIONS = 1;
    const TRANSACTION_TIMEOUT = 30000; // 30 seconds
    const MESSAGE_PROCESSED_STATE = 2;

    let creditor: string, debitor: string;

    beforeEach(async function () {
        contracts = await deployContractsFixture();

        const signers = await ethers.getSigners();
        // Validate that there are enough signers for testing
        if (signers.length < 3) {
            throw new Error("Not enough accounts available. At least 3 are required for testing.");
        }
        creditor = signers[2].address;
        debitor = signers[3].address;

        // Verify all contracts are available
        Object.entries(contracts).forEach(([name, contract]) => {
            if (!contract) {
                throw new Error(`Contract ${name} is undefined after fixture loading`);
            }
        });
    });

    /**
     * Generates a valid instruction ID for testing
     * Creates an alphanumeric string within the length constraints
     */
    function generateInstructionId(): string {
        const timestamp = Date.now().toString(36); // Base36 timestamp
        const random = Math.random().toString(36).slice(2, 6); // 4 random chars
        return `TEST_${timestamp}_${random}`.slice(0, 32); // Ensure max length
    }

    it("Should process PACS008 message through local routing using chain ID 0", async function () {
        // Get test accounts
        const { admin } = await getNamedAccounts();
        const creditorSigner = await ethers.getSigner(creditor);

        // Initialize service with local chain ID
        const handlerAddress = await contracts.messageHandler.getAddress();
        const msgService = new PACS008MessageServiceImpl(
            contracts.protocolCoordinator,
            1 // Local routing chain ID
        );

        // Prepare test message data with valid instruction ID
        const messageData = {
            debtorAddr: debitor,
            creditorAddr: creditor,
            tokenAddr: ethers.Wallet.createRandom().address,
            amount: ethers.parseEther("1"),
            instructionId: generateInstructionId(),
            handlerAddr: handlerAddress
        };

        let submissionResponse: MessageSubmissionResponse;

        try {
            // Log test message data for debugging
            console.log('Submitting message with data:', {
                ...messageData,
                amount: ethers.formatEther(messageData.amount) + ' tokens'
            });

            // First check the message fees
            const fees = await msgService.getMessageFees(messageData);
            console.log('Estimated fees:', ethers.formatEther(fees.totalFee), 'ETH');

            // Submit the message with confirmation options
            submissionResponse = await msgService.submitMessage(
                messageData,
                creditorSigner,
                {
                    confirmations: EXPECTED_CONFIRMATIONS,
                    timeout: TRANSACTION_TIMEOUT,
                    decodeEvents: true // Enable automatic event decoding
                }
            );

            // Wait for transaction confirmation
            await submissionResponse.wait(EXPECTED_CONFIRMATIONS);

            // Verify transaction status
            expect(submissionResponse.status).to.equal(TransactionStatus.CONFIRMED);
            console.log(submissionResponse)

            // Log all events with their details
            console.log('Events:', submissionResponse.events?.map(event => ({
                name: event.fragment?.name,  // Try fragment.name instead of eventName
                args: event.args,
                topics: event.topics,
                data: event.data
            })));

            // Modify the event search to use fragment.name
            const submissionEvent = submissionResponse.events?.find(
                event => event.fragment?.name === "MessageSubmissionInitiated"
            );

            expect(submissionEvent, "MessageSubmissionInitiated event not found").to.exist;

            // Extract message ID from event
            const messageId = submissionEvent?.args?.messageId;
            expect(messageId, "Message ID not found in event").to.exist;

            // Get message details from registry
            const message = await contracts.messageRegistry.getMessage(messageId);
            expect(message, "Message not found in registry").to.exist;

            // Verify message chain ID
            expect(Number(message.targetChain))
                .to.equal(1, "Target chain should be 0 for local routing");

            // Wait for message processing using helper function
            await waitForMessageProcessing(messageId, MESSAGE_PROCESSED_STATE);

            // Check final message status
            const finalStatus = await contracts.messageRegistry.getMessageStatus(messageId);
            expect(Number(finalStatus))
                .to.equal(MESSAGE_PROCESSED_STATE, "Message should be in PROCESSED state");

            // Log gas usage information
            if (submissionResponse.gasInfo) {
                console.log('Gas Usage:', {
                    //: submissionResponse.gasInfo.gasLimit.toString(),
                    gasUsed: submissionResponse.gasInfo.gasUsed.toString(),
                    effectiveGasPrice: ethers.formatUnits(
                        submissionResponse.gasInfo.effectiveGasPrice,
                        'gwei'
                    ) + ' gwei',
                    totalGasCost: ethers.formatEther(
                        submissionResponse.gasInfo.totalGasCost
                    ) + ' ETH'
                });
            }

            // Verify transaction hasn't been reorged
            const isValid = await submissionResponse.verifyTransaction();
            expect(isValid, "Transaction should not be reorged").to.be.true;

        } catch (error) {
            // Enhanced error handling
            if (error instanceof MessageSubmissionError) {
                console.error('Message Submission Error:', {
                    message: error.message,
                    cause: error.cause,
                });
                if ('revertReason' in error) {
                    console.error('Revert Reason:', error.revertReason);
                }
            }
            throw error;
        }
    });

    /**
     * Helper function to wait for message processing
     * @param messageId - The ID of the message to wait for
     * @param expectedStatus - The expected final status
     * @param maxAttempts - Maximum number of attempts to check status
     */
    async function waitForMessageProcessing(
        messageId: string,
        expectedStatus: number,
        maxAttempts: number = 10
    ): Promise<void> {
        for (let i = 0; i < maxAttempts; i++) {
            const status = await contracts.messageRegistry.getMessageStatus(messageId);
            if (Number(status) === expectedStatus) {
                return;
            }
            await ethers.provider.send("evm_mine", []);
        }
        throw new Error(`Message processing timeout: Status not reached after ${maxAttempts} attempts`);
    }
});