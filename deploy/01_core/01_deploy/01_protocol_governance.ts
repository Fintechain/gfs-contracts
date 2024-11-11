import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { deployer, platformAdmin } = await getNamedAccounts();

    const defaultAdmin = platformAdmin; // or any other address you want to set as default admin

    await deploy("ProtocolGovernance", {
        from: platformAdmin,
        args: [],
        log: true,
    });

    return true;
};

func.id = "ProtocolGovernance";
func.tags = ["core", "ProtocolGovernance"];

export default func;
