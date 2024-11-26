import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";
import { isTestnetMarket, loadProtocolConfig } from "../../src/market-config-helpers";
import { network } from "hardhat";
import { isUnitMode } from "../../src/utils/deploy-helper";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { admin } = await getNamedAccounts();

    if (isUnitMode()) {
        await deploy("MockMessageProcessor", { from: admin, args: [], log: true });
        await deploy("MockWormhole", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
        await deploy("MockWormholeRelayer", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
    }
    
    await deploy("MessageProcessor", { from: admin, args: [], log: true });

    return true;
};

func.id = "MessageProcessor";
func.tags = ["core", "MessageProcessor"];

export default func;
