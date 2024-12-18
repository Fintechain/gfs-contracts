import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { admin } = await getNamedAccounts();

    await deploy("TargetRegistry", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
    await deploy("MessageProcessor", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
    await deploy("MessageRegistry", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
    await deploy("MessageProtocol", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
    await deploy("ProtocolGovernance", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });

    return true;
};

func.id = "Core";
func.tags = ["protocol", "core", "Core"];

export default func;
