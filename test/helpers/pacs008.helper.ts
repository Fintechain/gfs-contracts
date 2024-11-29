import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import {
    PACS008MessageServiceImpl
} from "../../src/services/pacs008-message.service";
import { MessageRegistry } from "../../typechain";
import { MessageSubmissionResponse, TransactionStatus } from "../../src/types/message-service";
import { 
    Interface, 
    ContractTransactionReceipt,
    Log
} from 'ethers';

/**
 * Interface for decoded event
 */
interface DecodedEvent {
    name: string;
    args: any;
}

/**
 * Constants used across PACS008 message testing
 * @remarks These values match the contract configurations and test requirements
 */
export const TEST_CONSTANTS = {
    /** Number of block confirmations to wait for */
    EXPECTED_CONFIRMATIONS: 1,
    /** Maximum time to wait for transaction confirmation (in ms) */
    TRANSACTION_TIMEOUT: 30000,
    /** Expected state ID for processed messages */
    MESSAGE_PROCESSED_STATE: 2,
    /** Minimum allowed message amount (from PACS008Handler contract) */
    MINIMUM_AMOUNT: ethers.parseEther("0.000001"),
    /** Maximum allowed message amount (from PACS008Handler contract) */
    MAXIMUM_AMOUNT: ethers.parseEther("1000000"),
    /** Chain ID for local message routing */
    LOCAL_CHAIN_ID: 1
};

/**
 * Creates a unique instruction ID for message testing
 * @returns A string of max length 32 containing timestamp and random values
 * @remarks Format: TEST_[timestamp-base36]_[random-4chars]
 */
export function generateInstructionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `TEST_${timestamp}_${random}`.slice(0, 32);
}

/**
 * Interface defining the structure of a PACS008 message
 */
interface PACS008MessageData {
    debtorAddr: string;
    creditorAddr: string;
    tokenAddr: string;
    amount: bigint;
    instructionId: string;
    handlerAddr: string;
}

/**
 * Creates message data for PACS008 message testing
 * @param amount - The amount to transfer
 * @param sender - The sender's address
 * @param receiver - The receiver's address
 * @param handlerAddress - The message handler contract address
 * @returns A properly formatted PACS008 message data object
 */
export async function createMessageData(
    amount: bigint,
    sender: string,
    receiver: string,
    handlerAddress: string
): Promise<PACS008MessageData> {
    return {
        debtorAddr: sender,
        creditorAddr: receiver,
        tokenAddr: ethers.Wallet.createRandom().address,
        amount: amount,
        instructionId: generateInstructionId(),
        handlerAddr: handlerAddress
    };
}

/**
 * Submits a message and verifies its initial processing
 * @param messageData - The PACS008 message data to submit
 * @param signer - The signer submitting the message
 * @param msgService - The message service instance
 * @returns Object containing messageId and submission response
 * @throws If message submission fails or verification checks fail
 */
export async function submitAndVerifyMessage(
    messageData: PACS008MessageData,
    signer: SignerWithAddress,
    msgService: PACS008MessageServiceImpl
): Promise<{ messageId: string, response: MessageSubmissionResponse }> {
    // Submit message with standard confirmation options
    const response = await msgService.submitMessage(
        messageData,
        signer,
        {
            confirmations: TEST_CONSTANTS.EXPECTED_CONFIRMATIONS,
            timeout: TEST_CONSTANTS.TRANSACTION_TIMEOUT,
            decodeEvents: true
        }
    );

    // Wait for transaction to be mined and get receipt
    const txResponse = await response.transaction;
    const receipt = await txResponse.wait(TEST_CONSTANTS.EXPECTED_CONFIRMATIONS);
    
    if (!receipt) {
        throw new Error("Failed to get transaction receipt");
    }

    // Verify transaction status
    expect(receipt.status).to.equal(1, "Transaction failed");

    // Find MessageSubmissionInitiated event and extract messageId
    let messageId: string | undefined;
    
    if (receipt.logs) {
        const interfaces = await getContractInterfaces();
        
        // Search through logs for MessageSubmissionInitiated event
        for (const log of receipt.logs) {
            for (const iface of interfaces) {
                try {
                    // Try to parse event with current interface
                    const parsedLog = iface.parseLog({
                        topics: [...log.topics],
                        data: log.data
                    });

                    if (parsedLog?.name === "MessageSubmissionInitiated") {
                        messageId = parsedLog.args.messageId;
                        break;
                    }
                } catch {
                    // Continue if this interface can't parse the log
                    continue;
                }
            }
            if (messageId) break;
        }
    }

    expect(messageId).to.exist, "MessageId not found in transaction events";
    
    // Save receipt in response for later use
    if (receipt) {
        response.receipt = receipt as ContractTransactionReceipt;
    }
    
    return { 
        messageId: messageId!,
        response 
    };
}

/**
 * Waits for a message to reach the expected processing status
 * @param messageRegistry - The message registry contract instance
 * @param messageId - The ID of the message to wait for
 * @param expectedStatus - The expected final status
 * @param maxAttempts - Maximum number of attempts to check status
 * @throws If message doesn't reach expected status within max attempts
 */
export async function waitForMessageProcessing(
    messageRegistry: MessageRegistry,
    messageId: string,
    expectedStatus: number,
    maxAttempts: number = 10
): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
        const status = await messageRegistry.getMessageStatus(messageId);
        if (Number(status) === expectedStatus) {
            return;
        }
        await ethers.provider.send("evm_mine", []);
    }
    throw new Error(`Message processing timeout: Status not reached after ${maxAttempts} attempts`);
}

/**
 * Verifies that a message has been processed successfully
 * @param messageRegistry - The message registry contract instance
 * @param messageId - The ID of the message to verify
 * @throws If message is not in PROCESSED state
 */
export async function verifyMessageProcessed(
    messageRegistry: MessageRegistry,
    messageId: string
): Promise<void> {
    const status = await messageRegistry.getMessageStatus(messageId);
    expect(Number(status)).to.equal(TEST_CONSTANTS.MESSAGE_PROCESSED_STATE);
}

/**
 * Verifies correct state transitions from message events
 * @param response - The message submission response
 * @throws If expected state transition events are missing
 */
export async function verifyStateTransitions(
    response: MessageSubmissionResponse
): Promise<void> {
    const txResponse = await response.transaction;
    const receipt = await txResponse.wait(1);
    
    if (!receipt) {
        throw new Error("Failed to get transaction receipt");
    }

    const decodedEvents = await parseEvents(receipt);

    // Debug output
    //console.log('Decoded Events:', decodedEvents.map(e => e.name));

    // Required event sequence
    const requiredEvents = [
        "MessageSubmissionInitiated",
        "MessageRouted",
        "DeliveryCompleted",
        "MessageDelivered"
    ];

    // Check each required event
    for (const requiredEvent of requiredEvents) {
        const eventFound = decodedEvents.some(event => event.name === requiredEvent);
        if (!eventFound) {
            console.error(`Missing event: ${requiredEvent}`);
            console.error('Available events:', decodedEvents.map(e => e.name));
        }
        expect(eventFound, `Missing required event: ${requiredEvent}`).to.be.true;
    }
}

/**
 * Parse events from transaction receipt
 * @param receipt Transaction receipt
 * @returns Decoded events array
 */
async function parseEvents(receipt: ContractTransactionReceipt): Promise<DecodedEvent[]> {
    const decodedEvents: DecodedEvent[] = [];
    const interfaces = await getContractInterfaces();

    if (!receipt.logs) {
        console.warn('No logs found in receipt');
        return decodedEvents;
    }

    for (const log of receipt.logs) {
        for (const iface of interfaces) {
            try {
                const parsedLog = iface.parseLog({
                    topics: [...log.topics],
                    data: log.data
                });
                
                if (parsedLog) {
                    decodedEvents.push({
                        name: parsedLog.name,
                        args: parsedLog.args
                    });
                    break;
                }
            } catch {
                continue;
            }
        }
    }

    return decodedEvents;
}

/**
 * Gets interfaces for all relevant contracts
 * @returns Array of contract interfaces
 */
async function getContractInterfaces(): Promise<Interface[]> {
    // Get contract factories
    const ProtocolCoordinator = await ethers.getContractFactory("ProtocolCoordinator");
    const MessageRouter = await ethers.getContractFactory("MessageRouter");
    const MessageRegistry = await ethers.getContractFactory("MessageRegistry");
    const MessageProcessor = await ethers.getContractFactory("MessageProcessor");
    const PACS008Handler = await ethers.getContractFactory("PACS008Handler");
    const SettlementController = await ethers.getContractFactory("SettlementController");

    // Return interfaces with duplicates removed
    return [
        ProtocolCoordinator.interface,
        MessageRouter.interface,
        MessageRegistry.interface,
        MessageProcessor.interface,
        PACS008Handler.interface,
        SettlementController.interface
    ];
}