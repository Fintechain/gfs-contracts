import { ethers } from 'ethers';

/**
 * Generates a PACS.008 message payload in the required format
 * @param debtorAgent Address of the sending institution
 * @param creditorAgent Address of the receiving institution
 * @param token Address of the token being transferred
 * @param amount Amount to transfer
 * @returns Encoded payload string
 */
export function generatePACS008Payload(
    debtorAgent: string,
    creditorAgent: string,
    token: string,
    amount: bigint
): string {
    const instructionId = ethers.randomBytes(32);

    return ethers.concat([
        // Debtor agent - keccak256("debtorAgent")
        ethers.id("debtorAgent").slice(0, 10),
        ethers.zeroPadValue(debtorAgent, 32),
        
        // Creditor agent - keccak256("creditorAgent")  
        ethers.id("creditorAgent").slice(0, 10),
        ethers.zeroPadValue(creditorAgent, 32),
        
        // Token - keccak256("token")
        ethers.id("token").slice(0, 10),
        ethers.zeroPadValue(token, 32),
        
        // Amount - keccak256("amount")
        ethers.id("amount").slice(0, 10),
        ethers.zeroPadValue(ethers.toBeHex(amount), 32),
        
        // Instruction ID - keccak256("instructionId")
        ethers.id("instructionId").slice(0, 10),
        ethers.hexlify(instructionId)
    ]);
}

/**
 * Function selectors for PACS.008 message fields
 */
export const PACS008_SELECTORS = {
    DEBTOR_AGENT: ethers.id("debtorAgent").slice(0, 10),
    CREDITOR_AGENT: ethers.id("creditorAgent").slice(0, 10),
    TOKEN: ethers.id("token").slice(0, 10),
    AMOUNT: ethers.id("amount").slice(0, 10),
    INSTRUCTION_ID: ethers.id("instructionId").slice(0, 10)
} as const;