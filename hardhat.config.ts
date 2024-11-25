import { HardhatUserConfig } from "hardhat/config";
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-ethers';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import '@nomicfoundation/hardhat-chai-matchers'
import "dotenv/config";

const MNEMONIC = process.env.MNEMONIC || "";
const RPC_URL = process.env.ALCHEMY_API_URL || ""
const LOCALHOST_RPC_URL = process.env.LOCALHOST_RPC_URL || ""

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
        liquidityPoolAdmin: {
            default: 1,
        },
        provider: {
            default: 1,
        },
        governor: {
            default: 1,
        },
        executor: {
            default: 2,
        },
        emergencyAdmin: {
            default: 2,
        },
        settler: {
            default: 3,
        },
        operator: {
            default: 3,
        },
        validator: {
            default: 4,
        },
        formatAdmin: {
            default: 5,
        },
        msgHandlerAdmin: {
            default: 5,
        },
        registrar: {
            default: 6,
        },
        processor: {
            default: 7,
        },
        user: {
            default: 7,
        },
        voter: {
            default: 6,
        },
        voter1: {
            default: 6,
        },
        voter2: {
            default: 7,
        },
        voter3: {
            default: 8,
        },
    },
    networks: {
        // Hardhat network for unit testing
        hardhat: {
            tags: ["unit"], // Tag for unit testing
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
            live: false, // Not a live network
        },
        // Custom integration testing network
        gana: {
            url: LOCALHOST_RPC_URL, // Custom URL for integration testing
            accounts: {
                count: 10, // Enough accounts for integration tests
                mnemonic: MNEMONIC, // Optional, for deterministic accounts
            },
            live: true, // Not a live network
            chainId: 1337, // 
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
