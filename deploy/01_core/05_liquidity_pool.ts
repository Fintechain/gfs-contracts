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
        await deploy("MockLiquidityPool", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
    }

    await deploy("LiquidityPool", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });

    return true;
};

func.id = "LiquidityPool";
func.tags = ["core", "LiquidityPool"];

export default func;
