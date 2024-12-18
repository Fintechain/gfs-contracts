import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { LiquidityPool, SettlementController } from "../../typechain";
import { COMMON_DEPLOY_PARAMS } from "../../src/env";
import { DeploymentHelper } from "../../src/utils/deploy-helper";
import { CONTRACT_VARIANTS } from "../../src/constants/deployment";
import { ConfigNames, getProtocolConfig, loadProtocolConfig } from "../../src/utils/config-helpers";
import { isUnitMode } from "../../src/utils/deploy-utils";
import { eNetwork } from "../../src/types";
import { getWormholeAddresses } from "../../src/utils/wormhole-helper";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const config = getProtocolConfig();
    const { admin } = await getNamedAccounts();
    const environment = { getNamedAccounts, deployments, ...hre };

    // Initialize helper with protocol config
    const helper = new DeploymentHelper(environment, config);

    const network = (
        process.env.FORK ? process.env.FORK : hre.network.name
    ) as eNetwork;

    var { wormholeRelayer } = getWormholeAddresses(network, config);


    // Get the deployed contract
    const liquidityPool = await helper.getContract<LiquidityPool>("LiquidityPool");
    const settlementController = await helper.getContract<SettlementController>("SettlementController")

    const liquidityPoolAddr = await liquidityPool.getAddress();
    const settlementControllerAddr = await settlementController.getAddress();


    const deployment = await deploy("WormholeSettlementReceiver", {
        from: admin,
        args: [
            wormholeRelayer,
            settlementControllerAddr
        ],
        ...COMMON_DEPLOY_PARAMS
    });

    // Log deployment information
    console.log("WormholeSettlementReceiver deployed to:", deployment.address);
    console.log("Dependencies:");
    console.log("  - WormholeRelayer:", wormholeRelayer);
    console.log("  - LiquidityPool:", liquidityPoolAddr);
    console.log("  - SettlementController:", settlementControllerAddr);

    return true;
};

// Dependencies
func.dependencies = [
    "SettlementController"
];

func.id = "WormholeSettlementReceiver";
func.tags = ["remote", "WormholeSettlementReceiver"];

export default func;