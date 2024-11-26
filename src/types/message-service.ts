import { ethers } from "ethers";

/**
 * Base error class for message processing errors
 * Extends the native Error class with additional context
 * 
 * @abstract
 * @class MessageError
 * @extends {Error}
 */
export abstract class MessageError extends Error {
    /**
     * Creates an instance of MessageError
     * @param {string} message - The error message
     * @param {string} name - The name of the error type
     */
    protected constructor(message: string, name: string) {
        super(message);
        this.name = name;
        
        // Ensures proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Error thrown when message validation fails
 * Used for input validation and format checking
 * 
 * @class MessageValidationError
 * @extends {MessageError}
 */
export class MessageValidationError extends MessageError {
    /**
     * Creates an instance of MessageValidationError
     * @param {string} message - Detailed description of the validation failure
     */
    constructor(message: string) {
        super(message, 'MessageValidationError');
    }
}

/**
 * Error thrown when message submission fails
 * Used for network, contract, or transaction failures
 * 
 * @class MessageSubmissionError
 * @extends {MessageError}
 */
export class MessageSubmissionError extends MessageError {
    /**
     * Creates an instance of MessageSubmissionError
     * @param {string} message - Description of the submission failure
     * @param {unknown} [cause] - The underlying error that caused the failure
     */
    constructor(message: string, public readonly cause?: unknown) {
        super(message, 'MessageSubmissionError');
        
        // Capture stack trace for better debugging
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MessageSubmissionError);
        }
    }

    /**
     * Gets the root cause of the error if available
     * @returns {string} Description of the root cause or 'Unknown cause' if not available
     */
    public getRootCause(): string {
        if (!this.cause) return 'Unknown cause';
        
        if (this.cause instanceof Error) {
            return this.cause.message;
        }
        
        return String(this.cause);
    }
}

/**
 * Represents the fee structure for message processing
 * All fees are represented as BigInt to handle large numbers safely
 * 
 * @interface MessageFees
 */
export interface MessageFees {
    /** Base protocol fee for message processing */
    baseFee: bigint;
    
    /** Additional fee for message delivery */
    deliveryFee: bigint;
    
    /** Total fee required (baseFee + deliveryFee) */
    totalFee: bigint;
}

/**
 * Represents the confirmation status of a blockchain transaction
 */
export enum TransactionStatus {
    /** Transaction is pending confirmation */
    PENDING = 'PENDING',
    /** Transaction has been confirmed required number of blocks */
    CONFIRMED = 'CONFIRMED',
    /** Transaction failed during execution */
    FAILED = 'FAILED',
    /** Transaction was dropped or replaced */
    DROPPED = 'DROPPED'
}

/**
 * Detailed information about a transaction's gas usage
 */
export interface TransactionGasInfo {
    /** Gas limit set for the transaction */
    gasLimit: bigint;
    /** Actual gas used by the transaction */
    gasUsed: bigint;
    /** Effective gas price paid */
    effectiveGasPrice: bigint;
    /** Total gas cost in wei */
    totalGasCost: bigint;
}

/**
 * Extended event information with decoded data
 */
export interface DecodedEventLog extends ethers.EventLog {
    /** Decoded arguments from the event */
    decodedArgs: Record<string, unknown>;
    /** Original raw event data */
    raw: ethers.Log;
}

/**
 * Comprehensive response for a message submission transaction
 */
export interface MessageSubmissionResponse {
    /** Initial transaction response */
    transaction: ethers.ContractTransactionResponse;
    /** Transaction hash */
    hash: string;
    /** Current status of the transaction */
    status: TransactionStatus;
    /** Block number where transaction was included */
    blockNumber?: number;
    /** Number of confirmations received */
    confirmations: number;
    /** Detailed gas information */
    gasInfo?: TransactionGasInfo;
    /** Transaction receipt once available */
    receipt?: ethers.ContractTransactionReceipt;
    /** Decoded events emitted during transaction */
    events?: DecodedEventLog[];
    /** Any revert reason if transaction failed */
    revertReason?: string;
    
    /**
     * Wait for a specific number of confirmations
     * @param confirmations Number of confirmations to wait for
     * @param timeout Timeout in milliseconds
     */
    wait(confirmations?: number, timeout?: number): Promise<MessageSubmissionResponse>;
    
    /**
     * Get updated transaction status
     * Checks current chain state for latest status
     */
    getLatestStatus(): Promise<MessageSubmissionResponse>;
    
    /**
     * Verify transaction hasn't been reorged out of chain
     * @returns boolean indicating if transaction is still valid
     */
    verifyTransaction(): Promise<boolean>;
}

/**
 * Enhanced message service interface with better response handling
 */
export interface MessageService<T> {
    /**
     * Submits a message to the blockchain
     * 
     * @param message - The message to be submitted
     * @param userSigner - The signer that will submit the transaction
     * @param options - Additional submission options
     * @returns Promise resolving to comprehensive submission response
     * @throws MessageValidationError If the message fails validation
     * @throws MessageSubmissionError If the submission fails
     */
    submitMessage(
        message: T,
        userSigner: ethers.Signer,
        options?: MessageSubmissionOptions
    ): Promise<MessageSubmissionResponse>;
}

/**
 * Options for message submission
 */
export interface MessageSubmissionOptions {
    /** Number of confirmations to wait for */
    confirmations?: number;
    /** Whether to decode events automatically */
    decodeEvents?: boolean;
    /** Timeout for transaction in milliseconds */
    timeout?: number;
    /** Gas limit override */
    gasLimit?: bigint;
    /** Maximum gas price willing to pay */
    maxFeePerGas?: bigint;
    /** Maximum priority fee willing to pay */
    maxPriorityFeePerGas?: bigint;
    /** Nonce override */
    nonce?: number;
}

/**
 * Implementation of message submission response
 */
export class MessageSubmissionResponseImpl implements MessageSubmissionResponse {
    public status: TransactionStatus = TransactionStatus.PENDING;
    public confirmations: number = 0;
    public events: DecodedEventLog[] = [];
    public receipt?: ethers.ContractTransactionReceipt;
    public blockNumber?: number;
    public gasInfo?: TransactionGasInfo;
    public revertReason?: string;

    constructor(
        public transaction: ethers.ContractTransactionResponse,
        public hash: string,
        private provider: ethers.Provider,
        private contractInterface: ethers.Interface
    ) {}

    async wait(
        confirmations: number = 1,
        timeout?: number
    ): Promise<MessageSubmissionResponse> {
        try {
            const receipt = await this.transaction.wait(confirmations);
            if (receipt) {
                this.receipt = receipt;
                this.status = TransactionStatus.CONFIRMED;
                this.blockNumber = receipt.blockNumber;
                this.confirmations = await this.provider.getBlockNumber() - receipt.blockNumber;
                
                // In Ethers v6, gas information is accessed directly from receipt
                this.gasInfo = {
                    gasLimit: receipt.gas, // Changed from gasLimit to gas
                    gasUsed: receipt.gasUsed,
                    effectiveGasPrice: receipt.gasPrice,
                    totalGasCost: receipt.gasUsed * receipt.gasPrice
                };
                
                // Decode events
                this.events = receipt.logs
                    .filter(log => log.address === this.transaction.to)
                    .map(log => {
                        try {
                            const parsedLog = this.contractInterface.parseLog({
                                topics: log.topics,
                                data: log.data
                            });
                            
                            if (parsedLog) {
                                return {
                                    ...log,
                                    decodedArgs: this.extractEventArgs(parsedLog),
                                    raw: log
                                } as DecodedEventLog;
                            }
                            return null;
                        } catch {
                            return null;
                        }
                    })
                    .filter((event): event is DecodedEventLog => event !== null);
            }
            return this;
        } catch (error) {
            if (error instanceof Error && error.message.includes('timeout')) {
                this.status = TransactionStatus.PENDING;
            } else {
                this.status = TransactionStatus.FAILED;
                this.revertReason = await this.extractRevertReason(error);
            }
            throw new MessageSubmissionError(
                `Transaction failed: ${this.revertReason || 'Unknown error'}`,
                error
            );
        }
    }

    async getLatestStatus(): Promise<MessageSubmissionResponse> {
        try {
            const tx = await this.provider.getTransaction(this.hash);
            if (!tx) {
                this.status = TransactionStatus.DROPPED;
                return this;
            }

            const currentBlock = await this.provider.getBlockNumber();
            if (tx.blockNumber) {
                this.confirmations = currentBlock - tx.blockNumber;
                if (this.confirmations >= 1) {
                    this.status = TransactionStatus.CONFIRMED;
                    
                    // Get the receipt to update gas info
                    const receipt = await this.provider.getTransactionReceipt(this.hash);
                    if (receipt) {
                        this.updateFromReceipt(receipt);
                    }
                }
            }

            return this;
        } catch (error) {
            throw new MessageSubmissionError('Failed to get transaction status', error);
        }
    }

    async verifyTransaction(): Promise<boolean> {
        try {
            const receipt = await this.provider.getTransactionReceipt(this.hash);
            if (!receipt) return false;
            
            // Check if transaction is still in the same block (no reorg)
            if (this.receipt && receipt.blockHash !== this.receipt.blockHash) {
                return false;
            }
            
            return true;
        } catch (error) {
            throw new MessageSubmissionError('Failed to verify transaction', error);
        }
    }

    /**
     * Updates the response object with receipt information
     * @param receipt - The transaction receipt
     * @private
     */
    private updateFromReceipt(receipt: ethers.TransactionReceipt): void {
        this.receipt = receipt as ethers.ContractTransactionReceipt;
        this.blockNumber = receipt.blockNumber;
        this.gasInfo = {
            gasLimit: receipt.gas,
            gasUsed: receipt.gasUsed,
            effectiveGasPrice: receipt.gasPrice,
            totalGasCost: receipt.gasUsed * receipt.gasPrice
        };
    }

    /**
     * Extracts arguments from a parsed log into a record
     * @param parsedLog - The parsed log from the contract interface
     * @returns Record of argument names to values
     * @private
     */
    private extractEventArgs(parsedLog: ethers.LogDescription): Record<string, unknown> {
        const args: Record<string, unknown> = {};
        
        // Convert the args object to a regular record
        for (const key in parsedLog.args) {
            if (isNaN(Number(key))) { // Only include named parameters
                args[key] = parsedLog.args[key];
            }
        }
        
        return args;
    }

    /**
     * Extracts revert reason from an error
     * @param error - The error to extract from
     * @returns The extracted revert reason
     * @private
     */
    private async extractRevertReason(error: unknown): Promise<string> {
        if (!(error instanceof Error)) return 'Unknown error';
        
        // First try to extract from error message
        const revertMatch = error.message.match(/reverted with reason string '(.+)'/);
        if (revertMatch) return revertMatch[1];
        
        // Then try to parse custom error
        try {
            if ('data' in error && typeof error.data === 'string') {
                const customError = this.contractInterface.parseError(error.data);
                return customError ? `${customError.name}(${customError.args.join(',')})` : error.message;
            }

            // For Ethers v6, try to get the transaction and parse the revert data
            const tx = await this.provider.getTransaction(this.hash);
            if (tx) {
                const code = await this.provider.call(tx);
                const decoded = this.contractInterface.parseError(code);
                if (decoded) {
                    return `${decoded.name}(${decoded.args.join(',')})`;
                }
            }
        } catch {
            // If we can't parse custom error, return original message
        }

        return error.message;
    }
}