import { HardhatUserConfig } from "hardhat/config";
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-ethers';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import '@nomicfoundation/hardhat-chai-matchers'
import "dotenv/config";

const MNEMONIC = process.env.MNEMONIC || "";
const RPC_URL = process.env.ALCHEMY_API_URL || ""
const LOCALHOST_RPC_HOST = process.env.LOCALHOST_RPC_HOST || ""
const GANACHE_PORT = process.env.GANACHE_PORT || ""
const GETH_RPC_PORT = process.env.GETH_RPC_PORT || ""
const HARDHAT_PORT = process.env.HARDHAT_PORT || ""

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000,
            },
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        admin: {
            default: 1,
        },
    },
    networks: {
        // Hardhat network for unit testing
        hardhat: {
            /*
            forking: {
                url: TESTNET_RPC_URL, // Replace with actual RPC URL
                // blockNumber: TESTNET_BLOCK_NUMBER, // Use for reproducible tests
                enabled: true
            },
            */
            accounts: {
                count: 10, // Enough accounts for unit tests
                mnemonic: MNEMONIC, // Optional, for deterministic accounts
            },
            live: false,
        },
        // Custom integration testing network
        ganache: {
            url: LOCALHOST_RPC_HOST + ":" + GANACHE_PORT,
            accounts: {
                count: 10, // Enough accounts for integration tests
                mnemonic: MNEMONIC, // Optional, for deterministic accounts
            },
            live: true,
            chainId: 1337,
        },
        geth: {
            url: LOCALHOST_RPC_HOST + ":" + GETH_RPC_PORT,
            accounts: {
                count: 10, // Enough accounts for integration tests
                mnemonic: MNEMONIC, // Optional, for deterministic accounts
            },
            live: true,
            chainId: 1337,
        },
        // Sepolia testnet for live testing
        sepolia: {
            url: RPC_URL, // Replace with actual RPC URL
            accounts: {
                mnemonic: MNEMONIC, // Same mnemonic across environments for simplicity
            },
            chainId: 11155111, // Explicit Sepolia chain ID
        },
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v6",
    },
};

export default config;
