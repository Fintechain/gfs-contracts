import { getParamPerNetwork } from "../market-config-helpers";
import { eNetwork, eEthereumNetwork } from "../types";

// Get network-specific Wormhole contract addresses
export const getWormholeAddresses = (network: eNetwork, config: any) => {
    switch (network) {
        case "sepolia": {
            console.log(`Deploying on Sepolia testnet...`);
            return {
                wormholeRelayer: getParamPerNetwork(config.WormHoleRelayContracts, eEthereumNetwork.sepolia),
                wormhole: getParamPerNetwork(config.WormHoleCoreContracts, eEthereumNetwork.sepolia)
            };
        }
        case "holesky": {
            console.log(`Deploying on Holesky testnet...`);
            return {
                wormholeRelayer: getParamPerNetwork(config.WormHoleRelayContracts, eEthereumNetwork.holesky),
                wormhole: getParamPerNetwork(config.WormHoleCoreContracts, eEthereumNetwork.holesky)
            };
        }
        case "hardhat": {
            console.log(`Deploying on hardhat local network...`);
            return {
                wormholeRelayer: getParamPerNetwork(config.WormHoleRelayContracts, eEthereumNetwork.holesky),
                wormhole: getParamPerNetwork(config.WormHoleCoreContracts, eEthereumNetwork.holesky)
            };
        }
        default: {
            console.log(`Deploying on unknown network: ${network}`);
            return {
                wormholeRelayer: getParamPerNetwork(config.WormHoleRelayContracts, eEthereumNetwork.holesky),
                wormhole: getParamPerNetwork(config.WormHoleCoreContracts, eEthereumNetwork.holesky)
            };
        }
    }
};

