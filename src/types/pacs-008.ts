import { ethers } from "ethers";

export const MESSAGE_TYPE_PACS008 = ethers.keccak256(ethers.toUtf8Bytes("pacs.008"));

// Define required fields for PACS008
export const PACS008_REQUIRED_FIELDS = [
    ethers.id("debtorAgent").slice(0, 10),    // First 4 bytes
    ethers.id("creditorAgent").slice(0, 10),
    ethers.id("token").slice(0, 10),
    ethers.id("amount").slice(0, 10),
    ethers.id("instructionId").slice(0, 10)
];
/**
 * Message selectors for PACS008 message fields
 * These are the first 4 bytes of the keccak256 hash of each field name
 */
export const MESSAGE_SELECTORS = {
    debtorAgent: ethers.id("debtorAgent").slice(0, 10),
    creditorAgent: ethers.id("creditorAgent").slice(0, 10),
    token: ethers.id("token").slice(0, 10),
    amount: ethers.id("amount").slice(0, 10),
    instructionId: ethers.id("instructionId").slice(0, 10)
} as const;

/**
 * Interface representing a PACS008 message structure
 * @interface PACS008Message
 */
export interface PACS008Message {
    /** Ethereum address of the debtor agent */
    debtorAddr: string;
    /** Ethereum address of the creditor agent */
    creditorAddr: string;
    /** Ethereum address of the token contract */
    tokenAddr: string;
    /** Amount of tokens to transfer (in base units) */
    amount: bigint;
    /** Ethereum address of the message handler contract */
    handlerAddr: string;
    /** Unique identifier for the instruction */
    instructionId: string;
}