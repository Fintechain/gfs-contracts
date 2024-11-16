import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ProtocolCoordinator } from "../../../typechain";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const { admin } = await getNamedAccounts();

    // Get addresses of all required protocol components
    const messageRegistry = (await get("MessageRegistry")).address;
    const messageProtocol = (await get("MessageProtocol")).address;
    const messageRouter = (await get("MessageRouter")).address;
    const messageProcessor = (await get("MessageProcessor")).address;
    const settlementController = (await get("SettlementController")).address;

    // Deploy ProtocolCoordinator with all dependencies
    const deployment = await deploy("ProtocolCoordinator", {
        from: admin,
        args: [
            messageRegistry,      // _registry
            messageProtocol,      // _protocol
            messageProcessor,     // _processor
            messageRouter,        // _router
            settlementController // _settlement
        ],
        log: true,
        waitConfirmations: 1,
    });

    // Get contract instance for role verification
    const protocolCoordinator = (await hre.ethers.getContractAt(
        "ProtocolCoordinator",
        deployment.address
    )) as ProtocolCoordinator;

    // Get role identifiers
    const defaultAdminRole = await protocolCoordinator.DEFAULT_ADMIN_ROLE();
    const adminRole = await protocolCoordinator.ADMIN_ROLE();
    const operatorRole = await protocolCoordinator.OPERATOR_ROLE();
    const emergencyRole = await protocolCoordinator.EMERGENCY_ROLE();

    // Log deployment information
    console.log("\nProtocolCoordinator deployed successfully!");
    console.log("Address:", deployment.address);
    console.log("\nDependencies:");
    console.log(" - MessageRegistry:", messageRegistry);
    console.log(" - MessageProtocol:", messageProtocol);
    console.log(" - MessageRouter:", messageRouter);
    console.log(" - MessageProcessor:", messageProcessor);
    console.log(" - SettlementController:", settlementController);

    console.log("\nRole Verification:");
    console.log(" - Default Admin Role:", await protocolCoordinator.hasRole(defaultAdminRole, admin));
    console.log(" - Admin Role:", await protocolCoordinator.hasRole(adminRole, admin));
    console.log(" - Operator Role:", await protocolCoordinator.hasRole(operatorRole, admin));
    console.log(" - Emergency Role:", await protocolCoordinator.hasRole(emergencyRole, admin));

    // Verify initial configuration
    const baseFee = await protocolCoordinator.baseFee();
    const maxMessageSize = await protocolCoordinator.MAX_MESSAGE_SIZE();

    console.log("\nInitial Configuration:");
    console.log(" - Base Fee:", hre.ethers.formatEther(baseFee), "ETH");
    console.log(" - Max Message Size:", maxMessageSize.toString(), "bytes");

    if (hre.network.tags.production) {
        console.log("\n⚠️ Production Deployment Notes:");
        console.log(" - Verify contract on block explorer");
        console.log(" - Review all role assignments");
        console.log(" - Confirm component addresses");
        console.log(" - Validate base fee configuration");
    }

    return true;
};

// Dependencies that must be deployed before this contract
func.dependencies = [
    "MessageRegistry",
    "MessageProtocol",
    "MessageRouter",
    "MessageProcessor",
    "SettlementController"
];

func.id = "ProtocolCoordinator";
func.tags = ["core", "ProtocolCoordinator"];

export default func;