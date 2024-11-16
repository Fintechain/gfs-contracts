import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { admin } = await getNamedAccounts();


    await deploy("MessageRegistry", {
        from: admin,
        args: [],
        log: true,
    });

    return true;
};

func.id = "MessageRegistry";
func.tags = ["core", "local", "MessageRegistry"];

export default func;
