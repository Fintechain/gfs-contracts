import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";
import { isTestnetMarket, loadProtocolConfig } from "../../src/market-config-helpers";
import { network } from "hardhat";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { admin } = await getNamedAccounts();

    if (!network.live) {
        await deploy("MockMessageRegistry", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
    }

    await deploy("MessageRegistry", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });

    return true;
};

func.id = "MessageRegistry";
func.tags = ["core", "MessageRegistry"];

export default func;
