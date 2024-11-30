import { ethers } from "ethers";
import { ProtocolCoordinator } from "../../typechain";
import { MESSAGE_SELECTORS, MESSAGE_TYPE_PACS008, PACS008Message } from "../types/pacs-008";
import { 
    MessageService, 
    MessageFees, 
    MessageSubmissionError, 
    MessageValidationError,
    MessageSubmissionResponse,
    MessageSubmissionResponseImpl,
    MessageSubmissionOptions,
    TransactionStatus
} from "../types/message-service";

/**
 * Implementation of the MessageService interface for PACS008 messages
 * Handles the submission and fee calculation for PACS008 format messages
 * 
 * @class PACS008MessageServiceImpl
 * @implements {MessageService<PACS008Message>}
 */
export class PACS008MessageServiceImpl implements MessageService<PACS008Message> {
    /** Maximum allowed token amount (1 billion tokens in base units) */
    private static readonly MAX_AMOUNT = ethers.parseUnits("1000000000", 18);
    /** Minimum allowed token amount (0.000001 tokens in base units) */
    private static readonly MIN_AMOUNT = ethers.parseUnits("0.000001", 18);
    /** Maximum length for instruction ID in characters */
    private static readonly INSTRUCTION_ID_MAX_LENGTH = 32;
    /** Regular expression for valid instruction ID characters */
    private static readonly INSTRUCTION_ID_REGEX = /^[a-zA-Z0-9-_]+$/;
    /** Default number of confirmations to wait for */
    private static readonly DEFAULT_CONFIRMATIONS = 1;
    /** Default transaction timeout in milliseconds */
    private static readonly DEFAULT_TIMEOUT = 120_000; // 2 minutes

    /**
     * Creates an instance of PACS008MessageServiceImpl
     * @param protocolCoordinator - The protocol coordinator contract instance
     * @param chainId - The target chain ID for message submission (defaults to 1 for mainnet)
     */
    constructor(
        private readonly protocolCoordinator: ProtocolCoordinator,
        private readonly chainId: number = 1
    ) {}

    /**
     * Calculates the fees required for submitting a PACS008 message
     * @param message - The PACS008 message to calculate fees for
     * @returns Promise resolving to the fee breakdown
     * @throws {MessageValidationError} If message validation fails
     * @throws {MessageSubmissionError} If fee calculation fails
     */
    async getMessageFees(message: PACS008Message): Promise<MessageFees> {
        this.validateMessage(message);
        
        const payload = this.createPACS008Payload(message);
        const submission = this.createSubmission(message, payload);

        try {
            const [baseFee, deliveryFee] = await this.protocolCoordinator.quoteMessageFee(submission);
            return {
                baseFee,
                deliveryFee,
                totalFee: baseFee + deliveryFee
            };
        } catch (error) {
            throw new MessageSubmissionError(
                'Failed to quote message fees',
                error
            );
        }
    }

    /**
     * Submits a PACS008 message to the protocol coordinator
     * @param message - The PACS008 message to submit
     * @param userSigner - The signer for the transaction
     * @param options - Optional submission parameters
     * @returns Promise resolving to enhanced submission response
     * @throws {MessageValidationError} If message or signer validation fails
     * @throws {MessageSubmissionError} If submission fails
     */
    async submitMessage(
        message: PACS008Message,
        userSigner: ethers.Signer,
        options: MessageSubmissionOptions = {}
    ): Promise<MessageSubmissionResponse> {
        try {
            // Validate message and signer
            await this.validateSubmission(message, userSigner);

            // Create submission payload
            const payload = this.createPACS008Payload(message);
            const submission = this.createSubmission(message, payload);

            // Calculate required fees
            const { totalFee } = await this.getMessageFees(message);

            // Prepare transaction options
            const txOptions = await this.prepareTxOptions(options, totalFee);

            // Submit the transaction
            const tx = await this.protocolCoordinator.connect(userSigner)
                .submitMessage(submission, txOptions);

            // Create enhanced response
            const response = new MessageSubmissionResponseImpl(
                tx,
                tx.hash,
                userSigner.provider!,
                this.protocolCoordinator.interface
            );

            // Wait for confirmations if specified
            if (options.confirmations || PACS008MessageServiceImpl.DEFAULT_CONFIRMATIONS) {
                await response.wait(
                    options.confirmations || PACS008MessageServiceImpl.DEFAULT_CONFIRMATIONS,
                    options.timeout || PACS008MessageServiceImpl.DEFAULT_TIMEOUT
                );
            }

            return response;
        } catch (error) {
            if (error instanceof MessageValidationError) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new MessageSubmissionError(
                `Failed to submit PACS008 message: ${errorMessage}`,
                error
            );
        }
    }

    /**
     * Validates the submission prerequisites
     * @param message - The message to validate
     * @param signer - The signer to validate
     * @throws {MessageValidationError} If validation fails
     * @private
     */
    private async validateSubmission(
        message: PACS008Message,
        signer: ethers.Signer
    ): Promise<void> {
        // Validate message format and content
        this.validateMessage(message);
        
        // Validate signer has a provider
        if (!signer.provider) {
            throw new MessageValidationError('Signer must be connected to a provider');
        }

        // Calculate required fees
        const { totalFee } = await this.getMessageFees(message);

        // Validate signer has sufficient balance
        const signerAddress = await signer.getAddress();
        const balance = await signer.provider.getBalance(signerAddress);
        
        if (balance < totalFee) {
            throw new MessageValidationError(
                `Insufficient balance for fees. Required: ${ethers.formatEther(totalFee)} ETH`
            );
        }
    }

    /**
     * Prepares transaction options for submission
     * @param options - User provided options
     * @param totalFee - Required fee for the transaction
     * @returns Prepared transaction options
     * @private
     */
    private async prepareTxOptions(
        options: MessageSubmissionOptions,
        totalFee: bigint
    ): Promise<ethers.TransactionRequest> {
        const txOptions: ethers.TransactionRequest = {
            value: totalFee
        };

        // Apply optional overrides
        if (options.gasLimit) txOptions.gasLimit = options.gasLimit;
        if (options.maxFeePerGas) txOptions.maxFeePerGas = options.maxFeePerGas;
        if (options.maxPriorityFeePerGas) txOptions.maxPriorityFeePerGas = options.maxPriorityFeePerGas;
        if (options.nonce !== undefined) txOptions.nonce = options.nonce;

        return txOptions;
    }

    /**
     * Validates a PACS008 message structure and content
     * @param message - The message to validate
     * @throws {MessageValidationError} If validation fails
     * @private
     */
    public validateMessage(message: PACS008Message): void {
        // Validate all required addresses
        const addressValidations = [
            { address: message.debtorAddr, field: 'debtor' },
            { address: message.creditorAddr, field: 'creditor' },
            { address: message.tokenAddr, field: 'token' },
            { address: message.handlerAddr, field: 'handler' }
        ];

        for (const { address, field } of addressValidations) {
            if (!address) {
                throw new MessageValidationError(`${field} address is required`);
            }
            if (!ethers.isAddress(address)) {
                throw new MessageValidationError(`Invalid ${field} address format: ${address}`);
            }
        }

        // Validate debtor and creditor are different
        if (ethers.getAddress(message.debtorAddr) === ethers.getAddress(message.creditorAddr)) {
            throw new MessageValidationError('Debtor and creditor cannot be the same address');
        }

        // Validate amount
        if (typeof message.amount !== 'bigint') {
            throw new MessageValidationError('Amount must be a BigInt');
        }
        if (message.amount <= 0n) {
            throw new MessageValidationError('Amount must be positive');
        }
        if (message.amount < PACS008MessageServiceImpl.MIN_AMOUNT) {
            throw new MessageValidationError(
                `Amount below minimum: ${ethers.formatEther(PACS008MessageServiceImpl.MIN_AMOUNT)} tokens`
            );
        }
        if (message.amount > PACS008MessageServiceImpl.MAX_AMOUNT) {
            throw new MessageValidationError(
                `Amount exceeds maximum: ${ethers.formatEther(PACS008MessageServiceImpl.MAX_AMOUNT)} tokens`
            );
        }

        // Validate instruction ID
        if (!message.instructionId || message.instructionId.length === 0) {
            throw new MessageValidationError('Instruction ID is required');
        }
        if (message.instructionId.length > PACS008MessageServiceImpl.INSTRUCTION_ID_MAX_LENGTH) {
            throw new MessageValidationError(
                `Instruction ID exceeds maximum length of ${PACS008MessageServiceImpl.INSTRUCTION_ID_MAX_LENGTH} characters`
            );
        }
        if (!PACS008MessageServiceImpl.INSTRUCTION_ID_REGEX.test(message.instructionId)) {
            throw new MessageValidationError(
                'Instruction ID contains invalid characters. Only alphanumeric, hyphen, and underscore allowed'
            );
        }
    }

    /**
     * Creates a submission object for the protocol coordinator
     * @param message - The PACS008 message
     * @param payload - The encoded payload
     * @returns The formatted submission object
     * @private
     */
    private createSubmission(message: PACS008Message, payload: string) {
        return {
            messageType: MESSAGE_TYPE_PACS008,
            target: message.handlerAddr,
            targetChain: this.chainId,
            payload
        };
    }

    /**
     * Creates an encoded payload from a PACS008 message
     * @param message - The message to encode
     * @returns The encoded payload string
     * @throws {MessageValidationError} If payload creation fails
     * @private
     */
    public createPACS008Payload(message: PACS008Message): string {
        try {
            const encodedFields = [
                {
                    selector: MESSAGE_SELECTORS.debtorAgent,
                    value: ethers.zeroPadValue(ethers.getAddress(message.debtorAddr), 32)
                },
                {
                    selector: MESSAGE_SELECTORS.creditorAgent,
                    value: ethers.zeroPadValue(ethers.getAddress(message.creditorAddr), 32)
                },
                {
                    selector: MESSAGE_SELECTORS.token,
                    value: ethers.zeroPadValue(ethers.getAddress(message.tokenAddr), 32)
                },
                {
                    selector: MESSAGE_SELECTORS.amount,
                    value: ethers.zeroPadValue(ethers.toBeHex(message.amount), 32)
                },
                {
                    selector: MESSAGE_SELECTORS.instructionId,
                    value: ethers.zeroPadValue(ethers.toBeHex(ethers.encodeBytes32String(message.instructionId)), 32)
                }
            ];

            return ethers.concat(
                encodedFields.map(field => ethers.concat([field.selector, field.value]))
            );
        } catch (error) {
            throw new MessageValidationError(
                `Failed to encode message payload: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}