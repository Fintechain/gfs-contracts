import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    await deploy("MessageProtocol", {
        from: admin,
        args: [],
        log: true,
    });

    return true;
};

func.id = "MessageProtocol";
func.tags = ["core", "local", "MessageProtocol"];

export default func;
