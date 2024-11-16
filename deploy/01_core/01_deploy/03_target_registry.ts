import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { admin } = await getNamedAccounts();

    await deploy("TargetRegistry", {
        from: admin,
        args: [],
        log: true,
    });

    return true;
};

func.id = "TargetRegistry";
func.tags = ["core", "local", "TargetRegistry"];

export default func;
