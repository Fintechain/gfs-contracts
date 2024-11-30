import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { MARKET_NAME, COMMON_DEPLOY_PARAMS } from "../../src/env";
import { isProductionMarket, isTestnetMarket, loadProtocolConfig } from "../../src/market-config-helpers";
import { MESSAGE_TYPE_PACS008, PACS008_REQUIRED_FIELDS } from "../../src/types/";
import { SettlementController } from "../../typechain";
import { network } from "hardhat";
import { isUnitMode } from "../../src/utils/deploy-helper";
import { LOCAL_CHAIN_ID } from "../../src/constants";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const { admin } = await getNamedAccounts();

    // Get SettlementController
    var settlementController;
    var settlementControllerContract;

    const isUnitTest = hre.network.tags.unit;

    if (isUnitMode()) {

        settlementController = await get("MockSettlementController");
        settlementControllerContract = await hre.ethers.getContractAt("MockSettlementController", settlementController.address);
    }
    else {
        settlementController = await get("SettlementController");
        settlementControllerContract = await hre.ethers.getContractAt("SettlementController", settlementController.address);
    }

    // Deploy PACS008Handler
    const deployment = await deploy("PACS008Handler", {
        from: admin,
        args: [
            settlementController.address
        ],
        ...COMMON_DEPLOY_PARAMS
    });

    // Get contract instances for role setup and verification
    const pacs008Handler = await hre.ethers.getContractAt("PACS008Handler", deployment.address);


    const adminSigner = await hre.ethers.getSigner(admin);
    if (!isUnitMode()) {

        // 1. Grant SettlementController's HANDLER_ROLE to the handler
        const controller = settlementControllerContract as SettlementController
        await controller.connect(
            adminSigner).grantRole(await controller.HANDLER_ROLE(), deployment.address);


        // 2. Register the message format
        const messageProtocol = await hre.ethers.getContractAt("MessageProtocol", (await get("MessageProtocol")).address);

        await messageProtocol.connect(adminSigner).registerMessageFormat(
            MESSAGE_TYPE_PACS008, PACS008_REQUIRED_FIELDS, hre.ethers.toUtf8Bytes("PACS008_SCHEMA"));

        // 3. Register as message handler for the message type
        const messageProcessorAddr = (await get("MessageProcessor")).address;
        const messageProcessor = await hre.ethers.getContractAt("MessageProcessor", messageProcessorAddr);

        await messageProcessor.connect(adminSigner).registerMessageHandler(MESSAGE_TYPE_PACS008, deployment.address);
        await messageProcessor.connect(adminSigner).setRequiredAction(MESSAGE_TYPE_PACS008, 1);


        // 3. Grant PACS008Handler's PROCESSOR_ROLE to the MessageRouter
        await pacs008Handler.connect(adminSigner).grantRole(
            await pacs008Handler.PROCESSOR_ROLE(), (await get("MessageRouter")).address);

        // 4. Add Target route
        const targetRegistry = await hre.ethers.getContractAt("TargetRegistry", (await get("TargetRegistry")).address);
        
        await targetRegistry.connect(adminSigner).registerTarget(
            deployment.address, LOCAL_CHAIN_ID, 0, hre.ethers.toUtf8Bytes("PACS008_HANDLER"));

    }

    // Log deployment information
    console.log("\n=== PACS008Handler Deployment Information ===");
    console.log("Network:", await hre.ethers.provider.getNetwork().then(n => `${n.name} (${n.chainId})`));
    console.log("Contract Address:", deployment.address);

    console.log("\nDependencies:");
    console.log("- MockSettlementController:", settlementController.address);

    console.log("\nRole Verification:");
    console.log("- Default Admin Role:", await pacs008Handler.hasRole(await pacs008Handler.DEFAULT_ADMIN_ROLE(), admin));
    console.log("- Processor Role:", await pacs008Handler.hasRole(await pacs008Handler.PROCESSOR_ROLE(), admin));
    console.log("=======================================\n");


    return true;
};

func.dependencies = [
    "tokens",
    "core",
    "market"
];

func.id = "PACS008Handler";
func.tags = ["handlers", "PACS008Handler"];

export default func;