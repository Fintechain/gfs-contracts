import { HardhatUserConfig } from "hardhat/config";
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-ethers';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import '@nomicfoundation/hardhat-chai-matchers'
import "dotenv/config";

const MNEMONIC = process.env.MNEMONIC || "";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const HOLESKY_RPC_URL = process.env.HOLESKY_RPC_URL || "";
const GANACHE_HOST = process.env.GANACHE_HOST || "ganache";
const GANACHE_PORT = process.env.GANACHE_PORT || "8545";

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
            default: 0,
        },
    },
    networks: {
        hardhat: {
            /* forking: {
                url: SEPOLIA_RPC_URL, // Use Alchemy or Infura URL
            }, */
            accounts: {
                mnemonic: MNEMONIC,
                count: 10,
                accountsBalance: "1000000000000000000000", // 1000 ETH
            },
            live: false,
            saveDeployments: true,
        },
        ganache: {
            url: `http://${GANACHE_HOST}:${GANACHE_PORT}`,
            accounts: {
                mnemonic: MNEMONIC,
                count: 10,
                //                accountsBalance: "1000000000000000000000", // 1000 ETH
            },
            chainId: 1337,
            live: true,
            saveDeployments: true,
            tags: ["local", "test"],
            loggingEnabled: true,
            //            gasLimit: 12000000,
        },
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: {
                mnemonic: MNEMONIC,
            },
            chainId: 11155111,
            live: true,
            saveDeployments: true,
            tags: ["staging"],
            gasPrice: "auto",
            gasMultiplier: 5,               // 5x multiplier
            timeout: 60000,                 // Increase timeout to 60 seconds
        },

        holesky: {
            url: HOLESKY_RPC_URL,
            accounts: {
                mnemonic: MNEMONIC,
            },
            chainId: 17000,
            live: true,
            saveDeployments: true,
            tags: ["staging"],
            gasPrice: "auto",
            gasMultiplier: 1.3,
        },
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v6",
    },
    paths: {
        deployments: 'deployments',
        tests: 'test',
    },
    mocha: {
        timeout: 40000,
    },
};

export default config;