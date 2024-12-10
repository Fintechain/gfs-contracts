import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BaseContract, TransactionReceipt, TransactionResponse } from "ethers";
import { ContractNameToVariant } from "../types/deployment";
import { isUnitMode } from "./deploy-utils";
import { TransactionService } from "../service/transaction";
import { ProtocolConfiguration } from "../types";

/**
 * Helper class for managing contract deployments and retrieving deployed instances
 */
export class DeploymentHelper {
    private readonly config: ProtocolConfiguration;
    private readonly hre: HardhatRuntimeEnvironment;
    private readonly txService: TransactionService;

    constructor(hre: HardhatRuntimeEnvironment, config: ProtocolConfiguration) {
        this.hre = hre;
        this.config = config;
        this.txService = new TransactionService(hre, config.TransactionConfig);
    }

    /**
     * Waits for a transaction to be confirmed
     * Delegates to TransactionService with appropriate network configuration
     * 
     * @param tx Transaction to wait for
     * @returns Transaction receipt
     * @throws Error if transaction fails or times out
     * 
     * @example
     * const helper = new DeploymentHelper(hre);
     * const tx = await contract.someMethod();
     * const receipt = await helper.waitForTx(tx);
     */
    async waitForTx(tx: TransactionResponse): Promise<TransactionReceipt> {
        return this.txService.waitForTx(tx);
    }

    /**
     * Retrieves a deployed contract by name
     * @param name The contract name
     * @returns Deployed contract instance
     * @throws Error if contract deployment is not found
     * 
     * @example
     * const helper = new DeploymentHelper(hre);
     * const contract = await helper.getDeployedContract("TokenContract");
     */
    async getDeployedContract(name: string): Promise<BaseContract> {
        const { deployments } = this.hre;
        const { get } = deployments;
        
        const contractDeployment = await get(name);
        return await this.hre.ethers.getContractAt(name, contractDeployment.address);
    }

    /**
     * Retrieves a deployed contract instance with proper typing and variant handling
     * @template T The contract type from typechain
     * @param variant Contract variant (mock/real) definition
     * @returns Typed contract instance
     * @throws Error if contract deployment is not found
     * 
     * @example
     * const helper = new DeploymentHelper(hre);
     * const registry = await helper.getContractVariantInstance<TargetRegistry>(
     *     CONTRACT_VARIANTS.TargetRegistry
     * );
     */
    async getContractVariantInstance<T extends BaseContract>(
        variant: ContractNameToVariant<string>
    ): Promise<T> {
        const contractName = isUnitMode() ? variant.mock : variant.real;
        const deployment = await this.hre.deployments.get(contractName);
        const contract = await this.hre.ethers.getContractAt(contractName, deployment.address);
        
        return contract as unknown as T;
    }

    /**
     * Gets a typed contract instance
     * @template T The contract type from typechain
     * @param name Contract name
     * @returns Typed contract instance
     * 
     * @example
     * const helper = new DeploymentHelper(hre);
     * const token = await helper.getContract<ERC20>("TokenContract");
     */
    async getContract<T extends BaseContract>(name: string): Promise<T> {
        const contract = await this.getDeployedContract(name);
        return contract as unknown as T;
    }
}

// Usage example:
/*
import { TargetRegistry, ERC20 } from '../typechain-types';
import { CONTRACT_VARIANTS } from './registry';

async function example(hre: HardhatRuntimeEnvironment) {
    const helper = new DeploymentHelper(hre);

    // Get typed contract variant
    const registry = await helper.getContractVariantInstance<TargetRegistry>(
        CONTRACT_VARIANTS.TargetRegistry
    );

    // Get regular contract with type
    const token = await helper.getContract<ERC20>("TokenContract");

    // Get untyped contract
    const genericContract = await helper.getDeployedContract("SomeContract");
}
*/