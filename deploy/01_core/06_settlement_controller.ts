import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SettlementController } from "../../typechain";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";
import { isTestnetMarket, loadProtocolConfig } from "../../src/market-config-helpers";
import { network } from "hardhat";
import { isUnitMode } from "../../src/utils/deploy-helper";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const { admin } = await getNamedAccounts();

    var liquidityPool;

    // Get dependency addresses
    // Note: These contracts should be deployed before SettlementController
    if (isUnitMode()) {
        await deploy("MockSettlementController", { from: admin, args: [],  ...COMMON_DEPLOY_PARAMS });
        
        liquidityPool = (await get("MockLiquidityPool"));
    }
    else {
        liquidityPool = (await get("LiquidityPool"));
    }

    const deployment = await deploy("SettlementController", {
        from: admin,
        args: [liquidityPool.address],
        ...COMMON_DEPLOY_PARAMS 
    });

    // Get the deployed contract with proper typing
    const settlementController = (await hre.ethers.getContractAt(
        "SettlementController",
        deployment.address
    )) as SettlementController;

    // Verify roles are set correctly
    const defaultAdminRole = await settlementController.DEFAULT_ADMIN_ROLE();

    // Log deployment information
    console.log("SettlementController deployed to:", deployment.address);
    console.log("Dependencies:");
    console.log("  - LiquidityPool:", liquidityPool);

    console.log("Roles:");
    console.log("  - Default Admin:", await settlementController.hasRole(defaultAdminRole, admin));

    return true;
};

// Dependencies
func.dependencies = [
    "tokens",
    "core",
];

func.id = "SettlementController";
func.tags = ["market", "SettlementController"];

export default func;