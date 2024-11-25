import { ethers } from "ethers";
import { ProtocolCoordinator } from "../../typechain";
import { MESSAGE_TYPE_PACS008 } from "../types/";

export interface PACS008MessageService {
    /**
     * 
     * @param message 
     */
    submitMessage(message: PACS008Message, userSigner: any): Promise<ethers.ContractTransactionResponse>;
}

export interface PACS008Message {
    debtorAddr: string;
    creditorAddr: string;
    tokenAddr: string;
    amount: bigint;
    handlerAddr: string;
    instructionId: string;
}

export class PACS008MessageServiceImpl implements PACS008MessageService {

    /**
     * 
     * @param protocol 
     */
    constructor(public protocolCoordinator: ProtocolCoordinator){

    }

    /**
     * 
     * @param message 
     */
    async submitMessage(message: PACS008Message, userSigner: any): Promise<ethers.ContractTransactionResponse> {
        // Create proper payload
        const payload = this.createPACS008Payload(message);

        // Create submission using LOCAL_CHAIN (0) for local routing
        const submission = {
            messageType: MESSAGE_TYPE_PACS008,
            target: message.handlerAddr,
            targetChain: 0, // Use 0 to indicate local routing
            payload
        };

        // Get fees and submit message
        const [baseFee, deliveryFee] = await this.protocolCoordinator.quoteMessageFee(submission);
        const totalFee = baseFee + deliveryFee;


        return await this.protocolCoordinator.connect(userSigner)
            .submitMessage(submission, { value: totalFee });
    }

    /**
     * 
     * @param message 
     * @returns 
     */
    createPACS008Payload(message: PACS008Message) {
        // Create field selectors (4 bytes each)
        const debtorAgentSelector = ethers.id("debtorAgent").slice(0, 10);  // First 4 bytes
        const creditorAgentSelector = ethers.id("creditorAgent").slice(0, 10);
        const tokenSelector = ethers.id("token").slice(0, 10);
        const amountSelector = ethers.id("amount").slice(0, 10);
        const instructionIdSelector = ethers.id("instructionId").slice(0, 10);
    
        // Encode each field with its selector
        const encodedFields = [
            {
                selector: debtorAgentSelector,
                value: ethers.zeroPadValue(ethers.getAddress(message.debtorAddr), 32)
            },
            {
                selector: creditorAgentSelector,
                value: ethers.zeroPadValue(ethers.getAddress(message.creditorAddr), 32)
            },
            {
                selector: tokenSelector,
                value: ethers.zeroPadValue(ethers.getAddress(message.tokenAddr), 32)
            },
            {
                selector: amountSelector,
                value: ethers.zeroPadValue(ethers.toBeHex(message.amount), 32)
            },
            {
                selector: instructionIdSelector,
                value: ethers.zeroPadValue(message.instructionId, 32)
            }
        ];
    
        // Concatenate all fields
        return ethers.concat(
            encodedFields.map(field => ethers.concat([field.selector, field.value]))
        );
    }

}