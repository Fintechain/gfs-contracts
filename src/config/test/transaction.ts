import { DEFAULT_TX_CONFIG, eEthereumNetwork, TxConfigPerNetwork } from "../../types"

/**
 * Network-specific transaction configurations
 * Optimized for different chain characteristics:
 * - L1: Higher confirmations for security
 * - L2: Lower confirmations for speed
 * - Testnets: Basic configuration
 */
export const TX_CONFIGS: TxConfigPerNetwork = {
    [eEthereumNetwork.main]: {
        confirmations: 5,  // Higher security
        timeout: 300000,   // Longer timeout
        pollInterval: 5000 // Less frequent polling
    },
    [eEthereumNetwork.sepolia]: {
        confirmations: 5,  // Higher security
        timeout: 300000,   // Longer timeout
        pollInterval: 5000 // Less frequent polling
    },
    [eEthereumNetwork.holesky]: {
        confirmations: 5,  // Higher security
        timeout: 300000,   // Longer timeout
        pollInterval: 5000 // Less frequent polling
    },
    [eEthereumNetwork.hardhat]: {
        confirmations: 5,  // Higher security
        timeout: 300000,   // Longer timeout
        pollInterval: 5000 // Less frequent polling
    },
    [eEthereumNetwork.ganache]: DEFAULT_TX_CONFIG
}