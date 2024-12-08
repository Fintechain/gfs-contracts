import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { isTestnetMarket, loadProtocolConfig } from "../../src/market-config-helpers";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";
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
        await deploy("MockMessageProtocol", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
    }

    await deploy("MessageProtocol", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });

    return true;
};

func.id = "MessageProtocol";
func.tags = ["core", "MessageProtocol"];

export default func;
