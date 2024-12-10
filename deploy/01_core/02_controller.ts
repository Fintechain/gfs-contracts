import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { LiquidityPool, SettlementController } from "../../typechain";
import { COMMON_DEPLOY_PARAMS } from "../../src/env";
import { DeploymentHelper } from "../../src/utils/deploy-helper";
import { CONTRACT_VARIANTS } from "../../src/constants/deployment";
import { ConfigNames, getProtocolConfig, loadProtocolConfig } from "../../src/utils/config-helpers";

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

    // Get dependency
    const liquidityPool = await helper.getContractVariantInstance<LiquidityPool>(
        CONTRACT_VARIANTS.LiquidityPool
    );

    const liquidityPoolAddr = await liquidityPool.getAddress();

    // Deploy the SettlementController
    const deployment = await deploy("SettlementController", {
        from: admin, args: [liquidityPoolAddr], ...COMMON_DEPLOY_PARAMS
    });


    if (deployment.receipt) {
        
    }

    // Get the deployed contract with proper typing
    const settlementController = await helper.getContract<SettlementController>("SettlementController")

    // Verify roles are set correctly
    const defaultAdminRole = await settlementController.DEFAULT_ADMIN_ROLE();

    // Log deployment information
    console.log("SettlementController deployed to:", deployment.address);
    console.log("Dependencies:");
    console.log("  - LiquidityPool:", liquidityPoolAddr);

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