import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { COMMON_DEPLOY_PARAMS } from "../../src/env";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { admin } = await getNamedAccounts();

    await deploy("ProtocolGovernance", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });

    return true;
};

func.id = "ProtocolGovernance";
func.tags = ["core", "ProtocolGovernance"];

export default func;
