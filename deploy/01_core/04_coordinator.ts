import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { MessageProcessor, MessageProtocol, MessageRegistry, MessageRouter, ProtocolCoordinator } from "../../typechain";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";
import { isUnitMode } from "../../src/utils/deploy-utils";
import { CONTRACT_VARIANTS } from "../../src/constants/deployment";
import { DeploymentHelper } from "../../src/utils/deploy-helper";
import { ConfigNames, getProtocolConfig, loadProtocolConfig } from "../../src/utils/config-helpers";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const { admin } = await getNamedAccounts();
    const adminSigner = await hre.ethers.getSigner(admin);
    const environment = { getNamedAccounts, deployments, ...hre };

    // Initialize helper with protocol config
    const helper = new DeploymentHelper(environment, getProtocolConfig());

    // Define all message contracts
    const contracts = {
        messageRouter: await helper.getContractVariantInstance<MessageRouter>(
            CONTRACT_VARIANTS.MessageRouter
        ),
        messageRegistry: await helper.getContractVariantInstance<MessageRegistry>(
            CONTRACT_VARIANTS.MessageRegistry
        ),
        messageProtocol: await helper.getContractVariantInstance<MessageProtocol>(
            CONTRACT_VARIANTS.MessageProtocol
        ),
        messageProcessor: await helper.getContractVariantInstance<MessageProcessor>(
            CONTRACT_VARIANTS.MessageProcessor
        )
    };

    // Get addresses
    const addresses = {
        messageRouter: await contracts.messageRouter.getAddress(),
        messageRegistry: await contracts.messageRegistry.getAddress(),
        messageProtocol: await contracts.messageProtocol.getAddress(),
        messageProcessor: await contracts.messageProcessor.getAddress()
    };

    // Deploy ProtocolCoordinator
    const deployment = await deploy("ProtocolCoordinator", {
        from: admin,
        args: [
            addresses.messageRegistry,
            addresses.messageProtocol,
            addresses.messageRouter,
            addresses.messageProcessor,
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

        // First fetch all required roles

        // 1. Grant MessageProtocol's VALIDATOR_ROLE to the ProtocolCoordinator contract

        await helper.waitForTx(
            await contracts.messageProtocol.connect(adminSigner)
                .grantRole(await contracts.messageProtocol.VALIDATOR_ROLE(), deployment.address)
        );

        // 2. Grant MessageRegistry's REGISTRAR_ROLE and PROCESSOR_ROLE roles to the ProtocolCoordinator contract
        await helper.waitForTx(
            await contracts.messageRegistry.connect(adminSigner)
                .grantRole(await contracts.messageRegistry.REGISTRAR_ROLE(), deployment.address)
        );

        await helper.waitForTx(
            await contracts.messageRegistry.connect(adminSigner)
                .grantRole(await contracts.messageRegistry.PROCESSOR_ROLE(), deployment.address)
        );

        // 3. Grant MessageRouter's ROUTER_ROLE to the ProtocolCoordinator contract
        await helper.waitForTx(
            await contracts.messageRouter.connect(adminSigner)
                .grantRole(await contracts.messageRouter.ROUTER_ROLE(), deployment.address)
        );

        // 4. Grant MessageProcessor's PROCESSOR_ROLE to the ProtocolCoordinator contract
        await helper.waitForTx(
            await contracts.messageProcessor.connect(adminSigner)
                .grantRole(await contracts.messageProcessor.PROCESSOR_ROLE(), deployment.address)
        );


        // 2. Grant roles
        // Fetch ProtocolCoordinator roles
        // Grant roles to admin
        await helper.waitForTx(
            await protocolCoordinator.connect(adminSigner)
                .grantRole(await protocolCoordinator.OPERATOR_ROLE(), admin)
        );

        await helper.waitForTx(
            await protocolCoordinator.connect(adminSigner)
                .grantRole(await protocolCoordinator.EMERGENCY_ROLE(), admin)
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
    console.log(" - MessageRegistry:", addresses.messageRegistry);
    console.log(" - MessageProtocol:", addresses.messageProtocol);
    console.log(" - MessageRouter:", addresses.messageRouter);
    console.log(" - MessageProcessor:", addresses.messageProcessor);

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
func.tags = ["protocol", "market", "ProtocolCoordinator"];

export default func;