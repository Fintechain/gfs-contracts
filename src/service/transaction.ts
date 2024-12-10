import { TransactionResponse, TransactionReceipt, ContractTransaction } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TxConfigPerNetwork, NetworkTxConfig, DEFAULT_TX_CONFIG } from '../types/transaction';
import { eNetwork } from '../types/base';

/**
 * Service for managing transaction submission and confirmation
 * Handles network-specific configurations and timeout management
 */
export class TransactionService {
    private readonly config: NetworkTxConfig;

    private hre: HardhatRuntimeEnvironment;

    /**
     * Creates a new TransactionService instance
     * @param hre Hardhat Runtime Environment
     * @param configs Optional network-specific configurations
     */
    constructor(
        hre: HardhatRuntimeEnvironment,
        configs: TxConfigPerNetwork
    ) {
        this.hre = hre;
        this.config = configs[hre.network.name as eNetwork] || DEFAULT_TX_CONFIG;
    }

    /**
     * Waits for a transaction to be confirmed
     * Handles timeouts and confirmation requirements
     * 
     * @param tx Transaction to wait for
     * @returns Transaction receipt
     * @throws Error if transaction fails or times out
     * 
     * @example
     * const tx = await contract.someMethod();
     * const receipt = await txService.waitForTx(tx);
     */
    async waitForTx(tx: TransactionResponse): Promise<TransactionReceipt> {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
                () => reject(new Error(`Transaction timeout after ${this.config.timeout}ms`)),
                this.config.timeout
            );
        });

        const receiptPromise = tx.wait(this.config.confirmations);
        
        try {
            const receipt = await Promise.race([receiptPromise, timeoutPromise]);
            return receipt as TransactionReceipt;
        } catch (error: any) {
            throw new Error(`Transaction failed: ${error.message} (tx: ${tx.hash})`);
        }
    }

    /**
     * Waits for transaction confirmations and checks status
     * @param txHash Transaction hash to wait for
     * @param requiredConfirmations Number of block confirmations required 
     * @returns Transaction receipt with confirmation details
     * @throws Error if transaction reverts or times out
     */
    async waitForConfirmations(
        txHash: string, 
        requiredConfirmations: number = this.config.confirmations
    ): Promise<TransactionReceipt> {
        let receipt: TransactionReceipt | null = null;
        const startTime = Date.now();
    
        while (!receipt) {
            if (Date.now() - startTime > this.config.timeout) {
                throw new Error(`Transaction ${txHash} was not mined within ${this.config.timeout}ms`);
            }
    
            receipt = await this.hre.ethers.provider.getTransactionReceipt(txHash);
            
            if (!receipt) {
                await new Promise(r => setTimeout(r, this.config.pollInterval));
                continue;
            }
    
            const currentBlock = await this.hre.ethers.provider.getBlockNumber();
            const confirmations = currentBlock - receipt.blockNumber;
    
            if (confirmations < requiredConfirmations) {
                await new Promise(r => setTimeout(r, this.config.pollInterval));
                receipt = null;
                continue;
            }
    
            if (receipt.status === 0) {
                throw new Error(`Transaction ${txHash} reverted`);
            }
        }
    
        return receipt;
    }
}