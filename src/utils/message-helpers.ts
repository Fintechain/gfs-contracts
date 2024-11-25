import { ethers } from "hardhat";

export function CreatePACS008Payload(
    debtorAgent: string,
    creditorAgent: string,
    token: string,
    amount: bigint,
    instructionId: string
) {
    // Create field selectors (4 bytes each)
    const debtorAgentSelector = ethers.id("debtorAgent").slice(0, 10);  // First 4 bytes
    const creditorAgentSelector = ethers.id("creditorAgent").slice(0, 10);
    const tokenSelector = ethers.id("token").slice(0, 10);
    const amountSelector = ethers.id("amount").slice(0, 10);
    const instructionIdSelector = ethers.id("instructionId").slice(0, 10);

    // Encode each field with its selector
    const encodedFields = [
        // debtorAgent field
        {
            selector: debtorAgentSelector,
            value: ethers.zeroPadValue(ethers.getAddress(debtorAgent), 32)
        },
        // creditorAgent field
        {
            selector: creditorAgentSelector,
            value: ethers.zeroPadValue(ethers.getAddress(creditorAgent), 32)
        },
        // token field
        {
            selector: tokenSelector,
            value: ethers.zeroPadValue(ethers.getAddress(token), 32)
        },
        // amount field
        {
            selector: amountSelector,
            value: ethers.zeroPadValue(ethers.toBeHex(amount), 32)
        },
        // instructionId field
        {
            selector: instructionIdSelector,
            value: ethers.zeroPadValue(instructionId, 32)
        }
    ];

    // Concatenate all fields
    return ethers.concat(
        encodedFields.map(field => ethers.concat([field.selector, field.value]))
    );
}