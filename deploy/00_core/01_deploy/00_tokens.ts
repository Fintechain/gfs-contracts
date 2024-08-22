import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { LOG_DEPLOYMENTS } from "../../../src";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { deployer, platformAdmin } = await getNamedAccounts();

    const defaultAdmin = platformAdmin; // or any other address you want to set as default admin
    const pauser = platformAdmin; // or any other address you want to set as pauser
    const minter = platformAdmin; // or any other address you want to set as minter
    const upgrader = platformAdmin; // or any other address you want to set as upgrader

    const eRC20TokenArtifact = await deploy("ERC20Token", {
        from: deployer,
        proxy: {
            proxyContract: "OpenZeppelinTransparentProxy",
            execute: {
                init: {
                    methodName: "initialize",
                    args: ["GFS Dollar", "GFSUSD", defaultAdmin, pauser, minter],
                },
            },
        },
        log: LOG_DEPLOYMENTS,
    });

    const liquidStakingTokenImplArtifact = await deploy("LiquidStakingToken", {
        from: deployer,
        proxy: {
            proxyContract: "OpenZeppelinTransparentProxy",
            execute: {
                init: {
                    methodName: "initialize",
                    args: ["Staked GFS Dollar", "SGFSUSD", eRC20TokenArtifact.address, defaultAdmin, minter, upgrader],
                },
            },
        },
        log: LOG_DEPLOYMENTS,
    });

    const governanceTokenArtifact = await deploy("GovernanceToken", {
        from: deployer,
        proxy: {
            proxyContract: "OpenZeppelinTransparentProxy",
            execute: {
                init: {
                    methodName: "initialize",
                    args: ["GFS Coin", "GFSC", defaultAdmin, pauser, minter, upgrader],
                },
            },
        },
        log: LOG_DEPLOYMENTS,
    });

    return true;
};

func.id = "Tokens";
func.tags = ["core", "Tokens"];

export default func;