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
