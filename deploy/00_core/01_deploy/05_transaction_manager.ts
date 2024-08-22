import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { deployer, platformAdmin } = await getNamedAccounts();

    await deploy("TransactionManager", {
        from: deployer,
        proxy: {
            proxyContract: "OpenZeppelinTransparentProxy",
            execute: {
                init: {
                    methodName: "", // No method name means no initialization
                    args: [],
                },
            },
        },
        log: true,
    });

    return true;
};

func.id = "TransactionManager";
func.tags = ["core", "TransactionManager"];

export default func;
