import { eEthereumNetwork } from "../types";
import { ContractNameToVariant } from "../types/deployment";

/**
 * Creates a contract variant pair from a base contract name.
 * @template T - The base contract name type
 * @param {T} contractName - The base name of the contract
 * @returns {ContractNameToVariant<T>} A variant pair with mock and real names
 */
function createVariant<T extends string>(contractName: T): ContractNameToVariant<T> {
    return {
        mock: `Mock${contractName}` as const,
        real: contractName
    };
}

/**
 * Registry of all contract variants in the system.
 * Organized by contract category for better maintainability.
 */
export const CONTRACT_VARIANTS = {
    // Core Protocol Contracts
    TargetRegistry: createVariant("TargetRegistry"),
    MessageProcessor: createVariant("MessageProcessor"),
    LiquidityPool: createVariant("LiquidityPool"),
    MessageRouter: createVariant("MessageRouter"),
    MessageRegistry: createVariant("MessageRegistry"),
    MessageProtocol: createVariant("MessageProtocol"),
    SettlementController: createVariant("SettlementController"),
    
    // Token Contracts
    WETH: createVariant("WETH"),
    USDC: createVariant("USDC"),
    
    // Bridge and Validation Contracts
    TokenBridge: createVariant("TokenBridge"),
    Validator: createVariant("Validator"),
    
    // Infrastructure Contracts
    AddressProvider: createVariant("AddressProvider"),
    ConfigProvider: createVariant("ConfigProvider"),
} as const;

export type ProjectContractVariants = typeof CONTRACT_VARIANTS;
export type ProjectContractName = keyof ProjectContractVariants;

export const DEPLOYMENT_CONSTANTS = {
    VERIFICATION_DELAY_MS: 10000,
    MAX_RETRIES: 3,
    CONFIRMATION_BLOCKS: {
        [eEthereumNetwork.main]: 5,
        [eEthereumNetwork.sepolia]: 3,
        [eEthereumNetwork.holesky]: 3,
    },
    GAS_SETTINGS: {
        [eEthereumNetwork.main]: {
            maxFeePerGas: '100000000000',
            maxPriorityFeePerGas: '2000000000',
        },
        // Add other networks
    },
} as const;