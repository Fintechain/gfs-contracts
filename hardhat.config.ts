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
        deployer: 0,
        platformAdmin: 1,
        admin: 1,
        manager: 1,
        user: 3,
        user2: 4,
        formatAdmin: 1, 
        validator: 1
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v6",
    },
};

export default config;
