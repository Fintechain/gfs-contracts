// types/contracts.ts

import { BaseContract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export interface ContractVariant {
    mock: string;
    real: string;
}

/**
 * Represents a contract variant pair with mock and real implementations.
 * Mock name is automatically prefixed with 'Mock'.
 * @template T - The base contract name
 */
export type ContractNameToVariant<T extends string> = {
    /** Mock contract name, automatically prefixed with 'Mock' */
    mock: `Mock${T}`;
    /** Real contract name */
    real: T;
};

/**
 * Type representing all contract variants in the system.
 * Generated from CONTRACT_VARIANTS constant.
 */
export type ContractVariants = {
    [K in string]: ContractNameToVariant<string>;
};

/**
 * Union type of all contract names in the system.
 * Used for type-safe contract name references.
 */
export type ContractName<T extends ContractVariants> = keyof T;

/**
 * Configuration for contract deployment environments
 */
export interface IContractEnvironment {
    /** List of network names considered as test environments */
    testNetworks: string[];
}