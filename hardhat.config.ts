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
           /*  forking: {
                url: SEPOLIA_RPC_URL, // Use Alchemy or Infura URL
                blockNumber: 7193483
            }, */
            accounts: {
                mnemonic: MNEMONIC,
                count: 10,
                accountsBalance: "1000000000000000000000", // 1000 ETH
            },
            live: false,
            saveDeployments: true,
        },
        localhost: {
            url: "http://localhost:8545",
            accounts: {
                mnemonic: MNEMONIC,
                count: 10,
                accountsBalance: "1000000000000000000000", // 1000 ETH
            },
            live: false,
            saveDeployments: true,
        },
        ganache: {
            url: `http://0.0.0.0:${GANACHE_PORT}`,
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
            timeout: 60000  // increase timeout to 60 seconds
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
            timeout: 60000,   // Increase timeout to 60 seconds
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
    /* mocha: {
        timeout: 40000,
    }, */
};

export default config;