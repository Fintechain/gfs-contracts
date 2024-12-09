import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ProtocolCoordinator } from "../../typechain";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";
import { isUnitMode } from "../../src/utils/deploy-utils";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const { admin } = await getNamedAccounts();
    const adminSigner = await hre.ethers.getSigner(admin);

    var messageRouter;
    var messageRegistry;
    var messageProtocol;
    var messageProcessor;

    // For integration tests, always use real contracts
    if (isUnitMode()) {
        messageRouter = (await get("MockMessageRouter")).address;
        messageRegistry = (await get("MockMessageRegistry")).address;
        messageProtocol = (await get("MockMessageProtocol")).address;
        messageProcessor = (await get("MockMessageProcessor")).address;
    }
    else {
        // Use real contracts for mainnet or integration tests
        messageRouter = (await get("MessageRouter")).address;
        messageRegistry = (await get("MessageRegistry")).address;
        messageProtocol = (await get("MessageProtocol")).address;
        messageProcessor = (await get("MessageProcessor")).address;
    }

    // Deploy ProtocolCoordinator
    const deployment = await deploy("ProtocolCoordinator", {
        from: admin,
        args: [
            messageRegistry,
            messageProtocol,
            messageRouter,
            messageProcessor,
        ],
        ...COMMON_DEPLOY_PARAMS
    });

    // Get contract instance for role verification
    const protocolCoordinator = (await hre.ethers.getContractAt(
        "ProtocolCoordinator",
        deployment.address
    )) as ProtocolCoordinator;

    // Set up roles if this is a fresh deployment
    if (!isUnitMode()) {
        const protocolCoordinator = await hre.ethers.getContractAt(
            "ProtocolCoordinator",
            deployment.address
        );

        // 1. Grant MessageProtocol's VALIDATOR_ROLE to the ProtocolCoordinator contract
        const messageProtocolContract = await hre.ethers.getContractAt("MessageProtocol", messageProtocol);
        await messageProtocolContract.connect(
            adminSigner).grantRole(await messageProtocolContract.VALIDATOR_ROLE(), deployment.address);


        // 2. Grant MessageRegistry's REGISTRAR_ROLE and PROCESSOR_ROLE roles to the ProtocolCoordinator contract
        const messageRegistryContract = await hre.ethers.getContractAt("MessageRegistry", messageRegistry);
        await messageRegistryContract.connect(
            adminSigner).grantRole(await messageRegistryContract.REGISTRAR_ROLE(), deployment.address);

        await messageRegistryContract.connect(
            adminSigner).grantRole(await messageRegistryContract.PROCESSOR_ROLE(), deployment.address);

        // 3. Grant MessageRouter's ROUTER_ROLE to the ProtocolCoordinator contract
        const messageRouterContract = await hre.ethers.getContractAt("MessageRouter", messageRouter);
        await messageRouterContract.connect(
            adminSigner).grantRole(await messageRouterContract.ROUTER_ROLE(), deployment.address);


        // 4. Grant MessageProcessor's PROCESSOR_ROLE to the ProtocolCoordinator contract
        const messageProcessorContract = await hre.ethers.getContractAt("MessageProcessor", messageProcessor);
        await messageProcessorContract.connect(
            adminSigner).grantRole(await messageProcessorContract.PROCESSOR_ROLE(), deployment.address);


        // 2. Grant roles
        await protocolCoordinator.connect(adminSigner).grantRole(await protocolCoordinator.OPERATOR_ROLE(), admin);
        await protocolCoordinator.connect(adminSigner).grantRole(await protocolCoordinator.EMERGENCY_ROLE(), admin);

        await protocolCoordinator.connect(adminSigner).grantRole(
            await protocolCoordinator.EMERGENCY_ROLE(),
            admin
        );

        console.log("================================\n");
    }

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

    console.log("\nRole Verification:");
    console.log(" - Admin Role:", await protocolCoordinator.hasRole(adminRole, admin));
    console.log(" - Operator Role:", await protocolCoordinator.hasRole(operatorRole, admin));
    console.log(" - Emergency Role:", await protocolCoordinator.hasRole(emergencyRole, admin));
    console.log(" - Default Admin Role:", await protocolCoordinator.hasRole(defaultAdminRole, admin));

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
    "core",
    "MessageRegistry",
    "MessageProtocol",
    "MessageRouter",
    "MessageProcessor"
];

func.id = "ProtocolCoordinator";
func.tags = ["market", "ProtocolCoordinator"];

export default func;