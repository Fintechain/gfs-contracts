import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { MARKET_NAME, COMMON_DEPLOY_PARAMS } from "../../src/env";
import { MESSAGE_TYPE_PACS008, PACS008_REQUIRED_FIELDS } from "../../src/types";
import { LOCAL_CHAIN_ID } from "../../src/constants";
import {
    SettlementController,
    MessageProtocol,
    MessageProcessor,
    PACS008Handler,
    TargetRegistry
} from "../../typechain";
import { CONTRACT_VARIANTS } from "../../src/constants/deployment";
import { DeploymentHelper } from "../../src/utils/deploy-helper";
import { isUnitMode } from "../../src/utils/deploy-utils";
import { ConfigNames, getProtocolConfig, loadProtocolConfig } from "../../src/utils/config-helpers";

/**
 * Deploys and configures the PACS008Handler contract
 */
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

    // Get SettlementController instance
    const settlementController = await helper.getContractVariantInstance<SettlementController>(
        CONTRACT_VARIANTS.SettlementController
    );

    // Deploy PACS008Handler
    const deployment = await deploy("PACS008Handler", {
        from: admin,
        args: [await settlementController.getAddress()],
        ...COMMON_DEPLOY_PARAMS
    });

    // Get handler instance
    const pacs008Handler = await helper.getContract<PACS008Handler>("PACS008Handler");

    if (!isUnitMode()) {
        const adminSigner = await hre.ethers.getSigner(admin);

        // 1. Setup SettlementController
        await helper.waitForTx(
            await settlementController.connect(adminSigner).grantRole(
                await settlementController.HANDLER_ROLE(), deployment.address)
        );

        // 2. Setup MessageProtocol
        const messageProtocol = await helper.getContract<MessageProtocol>(
            "MessageProtocol"
        );

        await helper.waitForTx(
            await messageProtocol.connect(adminSigner).registerMessageFormat(
                MESSAGE_TYPE_PACS008,
                PACS008_REQUIRED_FIELDS,
                hre.ethers.toUtf8Bytes("PACS008_SCHEMA")
            )
        );

        // 3. Setup MessageProcessor
        const messageProcessor = await helper.getContract<MessageProcessor>(
            "MessageProcessor"
        );
        await helper.waitForTx(
            await messageProcessor.connect(adminSigner).registerMessageHandler(
                MESSAGE_TYPE_PACS008,
                deployment.address
            )
        );
        await helper.waitForTx(
            await messageProcessor.connect(adminSigner).setRequiredAction(
                MESSAGE_TYPE_PACS008,
                1
            )
        );

        // Grant PROCESSOR_ROLE to MessageProcessor
        await helper.waitForTx(
            await pacs008Handler.connect(adminSigner).grantRole(
                await pacs008Handler.PROCESSOR_ROLE(), await messageProcessor.getAddress())
        );

        // 4. Setup TargetRegistry
        const targetRegistry = await helper.getContract<TargetRegistry>(
            "TargetRegistry"
        );

        await helper.waitForTx(
            await targetRegistry.connect(adminSigner).registerTarget(
                deployment.address,
                LOCAL_CHAIN_ID,
                0,
                hre.ethers.toUtf8Bytes("PACS008_HANDLER")
            )
        );
    }

    // Log deployment details
    console.log("\n=== PACS008Handler Deployment Information ===");
    console.log("Network:", await hre.ethers.provider.getNetwork().then(n => `${n.name} (${n.chainId})`));
    console.log("Contract Address:", deployment.address);
    console.log("\nDependencies:");
    console.log("- SettlementController:", await settlementController.getAddress());
    console.log("\nRole Verification:");
    console.log("- Default Admin Role:", await pacs008Handler.hasRole(await pacs008Handler.DEFAULT_ADMIN_ROLE(), admin));
    console.log("- Processor Role:", await pacs008Handler.hasRole(await pacs008Handler.PROCESSOR_ROLE(), admin));
    console.log("=======================================\n");

    return true;
};

func.dependencies = ["tokens", "core", "market"];
func.id = "PACS008Handler";
func.tags = ["handlers", "PACS008Handler"];

export default func;