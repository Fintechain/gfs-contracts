import { HardhatUserConfig } from "hardhat/config";
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-ethers';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import '@nomicfoundation/hardhat-chai-matchers'
import "dotenv/config";

const MNEMONIC = process.env.MNEMONIC || "";
const RPC_URL = process.env.ALCHEMY_API_URL || "";
const LOCALHOST_RPC_HOST = process.env.LOCALHOST_RPC_HOST || "http://127.0.0.1";
const GANACHE_PORT = process.env.GANACHE_PORT || "8545";
const GETH_RPC_PORT = process.env.GETH_RPC_PORT || "8546";
const HARDHAT_PORT = process.env.HARDHAT_PORT || "8547";

// Logging configuration
console.log('Network Configuration:', {
    ganacheUrl: `${LOCALHOST_RPC_HOST}:${GANACHE_PORT}`,
    gethUrl: `${LOCALHOST_RPC_HOST}:${GETH_RPC_PORT}`,
    mnemonic: MNEMONIC ? 'Set' : 'Not Set'
});

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
        user: {
            default: 2,
        },
        voter1: {
            default: 3,
        }
    },
    networks: {
        hardhat: {
            accounts: {
                count: 10,
                mnemonic: MNEMONIC,
            },
            live: false,
            saveDeployments: true,
        },
        ganache: {
            url: `${LOCALHOST_RPC_HOST}:${GANACHE_PORT}`,
            accounts: {
                count: 10,
                mnemonic: MNEMONIC,
            },
            chainId: 1337,
            live: true,
            saveDeployments: true,
            tags: ["local", "test"],
            loggingEnabled: true,
        },
        geth: {
            url: `${LOCALHOST_RPC_HOST}:${GETH_RPC_PORT}`,
            accounts: {
                count: 10,
                mnemonic: MNEMONIC,
            },
            chainId: 1337,
            live: true,
            saveDeployments: true,
            tags: ["local", "test"],
            loggingEnabled: true,
        },
        sepolia: {
            url: RPC_URL,
            accounts: {
                mnemonic: MNEMONIC,
            },
            chainId: 11155111,
            live: true,
            saveDeployments: true,
            tags: ["staging"],
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