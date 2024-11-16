import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { MessageRouter } from "../../../typechain";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const { admin } = await getNamedAccounts();

    // Get dependency addresses
    // Note: These contracts should be deployed before MessageRouter
    const wormhole = (await get("Wormhole")).address;
    const targetRegistry = (await get("TargetRegistry")).address;
    const wormholeRelayer = (await get("WormholeRelayer")).address;
    const messageProcessor = (await get("MessageProcessor")).address;

    const deployment = await deploy("MessageRouter", {
        from: admin,
        args: [
            wormholeRelayer,     // _wormholeRelayer address
            wormhole,            // _wormhole core contract address
            targetRegistry,      // _targetRegistry contract address
            messageProcessor     // _messageProcessor contract address
        ],
        log: true,
        waitConfirmations: 1,
    });

    // Get the deployed contract with proper typing
    const messageRouter = (await hre.ethers.getContractAt(
        "MessageRouter",
        deployment.address
    )) as MessageRouter;

    // Verify roles are set correctly
    const defaultAdminRole = await messageRouter.DEFAULT_ADMIN_ROLE();
    const routerRole = await messageRouter.ROUTER_ROLE();
    const relayerRole = await messageRouter.RELAYER_ROLE();

    // Log deployment information
    console.log("MessageRouter deployed to:", deployment.address);
    console.log("Dependencies:");
    console.log(" - WormholeRelayer:", wormholeRelayer);
    console.log(" - Wormhole:", wormhole);
    console.log(" - TargetRegistry:", targetRegistry);
    console.log(" - MessageProcessor:", messageProcessor); // Added log
    console.log("Roles:");
    console.log(" - Default Admin:", await messageRouter.hasRole(defaultAdminRole, admin));
    console.log(" - Router Role:", await messageRouter.hasRole(routerRole, admin));
    console.log(" - Relayer Role:", await messageRouter.hasRole(relayerRole, admin));

    return true;
};

// Dependencies
func.dependencies = [
    "WormholeRelayer",
    "Wormhole",
    "TargetRegistry",
    "MessageProcessor"  // Added MessageProcessor dependency
];

func.id = "MessageRouter";
func.tags = ["core", "MessageRouter"];

export default func;