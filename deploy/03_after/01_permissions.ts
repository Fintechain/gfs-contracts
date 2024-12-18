import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { LiquidityPool, PACS008Handler, SettlementController } from "../../typechain";
import { getDeployedContract, isUnitMode } from "../../src/utils/deploy-utils";
import { DeploymentHelper } from "../../src/utils/deploy-helper";
import { getProtocolConfig } from "../../src/utils/config-helpers";


const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const { admin } = await getNamedAccounts();
    const environment = { getNamedAccounts, deployments, ...hre };

    // Initialize helper with protocol config
    const helper = new DeploymentHelper(environment, getProtocolConfig());

    if (!isUnitMode()) {

        const pacs008Handler = (await getDeployedContract("PACS008Handler", environment) as PACS008Handler);
        const liquidityPool = (await getDeployedContract("LiquidityPool", environment) as LiquidityPool);
        const settlementController = (await getDeployedContract("SettlementController", environment) as SettlementController);

        // Grant LiquidityPool SETTLEMENT_ROLE to handler
        await helper.waitForTx(
            await liquidityPool
                .grantRole(await liquidityPool.SETTLEMENT_ROLE(), await pacs008Handler.getAddress())
        );

        // Grant LiquidityPool SETTLEMENT_ROLE to controller
        await helper.waitForTx(
            await liquidityPool
                .grantRole(await liquidityPool.SETTLEMENT_ROLE(), await settlementController.getAddress())
        );
    }
};

func.tags = ["protocol", "post-deploy"];
func.runAtTheEnd = true;

export default func;