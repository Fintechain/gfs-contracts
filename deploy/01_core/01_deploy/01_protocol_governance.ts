import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { admin } = await getNamedAccounts();

    await deploy("ProtocolGovernance", {
        from: admin,
        args: [],
        log: true,
    });

    return true;
};

func.id = "ProtocolGovernance";
func.tags = ["core", "local", "ProtocolGovernance"];

export default func;
