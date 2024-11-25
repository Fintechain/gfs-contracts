import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { isTestnetMarket, loadProtocolConfig } from "../../src/market-config-helpers";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";
import { network } from "hardhat";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    if (!network.live) {
        await deploy("MockMessageProtocol", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
    }

    await deploy("MessageProtocol", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });

    return true;
};

func.id = "MessageProtocol";
func.tags = ["core", "MessageProtocol"];

export default func;
