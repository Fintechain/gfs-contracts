import { iParamsPerNetwork } from './base';

/**
 * Configuration parameters for transaction handling per network
 */
export interface NetworkTxConfig {
    /** Number of block confirmations to wait for */
    confirmations: number;
    /** Maximum time to wait for transaction (ms) */
    timeout: number;
    /** Time between confirmation checks (ms) */
    pollInterval: number;
}

/** Type for network-specific transaction configurations */
export type TxConfigPerNetwork = iParamsPerNetwork<NetworkTxConfig>;

/**
 * Default transaction configuration
 * Used for networks without specific settings
 */
export const DEFAULT_TX_CONFIG: NetworkTxConfig = {
    confirmations: 1,
    timeout: 60000,
    pollInterval: 1000
};
