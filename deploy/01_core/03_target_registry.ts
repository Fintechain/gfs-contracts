import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { MARKET_NAME } from "../../src/env";
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
        await deploy("MockTargetRegistry", { from: admin, args: [], log: true });
    }

    await deploy("TargetRegistry", { from: admin, args: [], log: true });

    return true;
};

func.id = "TargetRegistry";
func.tags = ["core", "TargetRegistry"];

export default func;
