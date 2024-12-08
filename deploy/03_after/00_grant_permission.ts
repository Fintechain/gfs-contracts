import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { getDeployedContract, isUnitMode } from "../../src/utils/deploy-helper";
import { getNamedAccounts } from "hardhat";
import { LiquidityPool, PACS008Handler, SettlementController } from "../../typechain";


const func: DeployFunction = async function (environment: HardhatRuntimeEnvironment) {
    const {
        getNamedAccounts,
        deployments,
        ...hre
    } = environment;

    const { deploy, get } = deployments;
    const { admin } = await getNamedAccounts();

    if (!isUnitMode()) {

        const pacs008Handler = (await getDeployedContract("PACS008Handler", environment) as PACS008Handler);
        const liquidityPool = (await getDeployedContract("LiquidityPool", environment) as LiquidityPool);
        const settlementController = (await getDeployedContract("SettlementController", environment) as SettlementController);

        // Grant LiquidityPool SETTLEMENT_ROLE to both handler and controller
        const SETTLEMENT_ROLE = await liquidityPool.SETTLEMENT_ROLE();

        await liquidityPool.grantRole(SETTLEMENT_ROLE, await pacs008Handler.getAddress());
        await liquidityPool.grantRole(SETTLEMENT_ROLE, await settlementController.getAddress());
    }
};

func.tags = ["post-deploy"];
func.runAtTheEnd = true;

export default func;