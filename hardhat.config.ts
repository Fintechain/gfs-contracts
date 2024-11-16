import { HardhatUserConfig } from "hardhat/config";
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-ethers';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import '@nomicfoundation/hardhat-chai-matchers'


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
        hardhat: {
            accounts: {
                count: 10, // Ensure we have enough accounts for testing
            }
        }
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v6",
    },
};

export default config;
