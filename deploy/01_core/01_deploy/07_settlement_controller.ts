import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SettlementController } from "../../../typechain";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // Get dependency addresses
    // Note: These contracts should be deployed before SettlementController
    const liquidityPool = (await get("LiquidityPool")).address;

    const deployment = await deploy("SettlementController", {
        from: admin,
        args: [
            liquidityPool      // _liquidityPool address
        ],
        log: true,
        waitConfirmations: 1,
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
    "LiquidityPool"
];

func.id = "SettlementController";
func.tags = ["core", "SettlementController"];

export default func;