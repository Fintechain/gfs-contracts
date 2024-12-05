import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";
import { loadProtocolConfig } from "../../src/market-config-helpers";
import { isUnitMode } from "../../src/utils/deploy-helper";
import { eEthereumNetwork, eNetwork } from "../../src/types";
import { getWormholeAddresses } from "../../src/utils/wormhole-helper";
import { MessageProcessor } from "../../typechain";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get, log } = deployments;
    const { admin } = await getNamedAccounts();
    const config = loadProtocolConfig(MARKET_NAME);
    const adminSigner = await hre.ethers.getSigner(admin);

    var targetRegistry;
    var messageProcessor;

    const network = (
        process.env.FORK ? process.env.FORK : hre.network.name
    ) as eNetwork;

    var { wormholeRelayer, wormhole } = getWormholeAddresses(network, config);

    if (isUnitMode()) {

        await deploy("MockMessageRouter",
            { from: admin, args: [], ...COMMON_DEPLOY_PARAMS }
        );

        targetRegistry = await get("MockTargetRegistry");
        messageProcessor = await get("MockMessageProcessor");

        wormhole = (await get("MockWormhole")).address;
        wormholeRelayer = ((await get("MockWormholeRelayer")).address);

    }
    else {
        targetRegistry = await get("TargetRegistry");
        messageProcessor = await get("MessageProcessor");
    }

    const deployment = await deploy("MessageRouter", {
        from: admin,
        args: [
            wormholeRelayer,
            wormhole,
            targetRegistry.address,
            messageProcessor.address
        ],
        ...COMMON_DEPLOY_PARAMS
    });

    /* if (!isUnitMode()) {
        // 1. Grant MessageProcessor's PROCESSOR_ROLE to the MessageRouter contract
        const messageProcessorContract = await hre.ethers.getContractAt("MessageProcessor", messageProcessor.address) as MessageProcessor;
        await messageProcessorContract.connect(
            adminSigner).grantRole(await messageProcessorContract.PROCESSOR_ROLE(), deployment.address);


        // 2. Grant TargetRegistry's VALIDATOR_ROLE to the MessageRouter contract
        const targetRegistryContract = await hre.ethers.getContractAt("TargetRegistry", targetRegistry.address);
        await targetRegistryContract.connect(
            adminSigner).grantRole(await targetRegistryContract.VALIDATOR_ROLE(), deployment.address);

        console.log("MessageRouter has PROCESSOR_ROLE in MessageProcessor:",
            await messageProcessorContract.hasRole(await messageProcessorContract.PROCESSOR_ROLE(), deployment.address)
        );

        console.log("MessageRouter has VALIDATOR_ROLE in TargetRegistry:",
            await targetRegistryContract.hasRole(await targetRegistryContract.VALIDATOR_ROLE(), deployment.address)
        );
    } */

    // Replace the permission granting section with this updated version
    if (!isUnitMode()) {
        console.log("Granting roles to MessageRouter...");

        const messageProcessorContract = await hre.ethers.getContractAt(
            "MessageProcessor",
            messageProcessor.address
        ) as MessageProcessor;

        // Grant PROCESSOR_ROLE with explicit wait
        const processorTx = await messageProcessorContract.connect(adminSigner)
            .grantRole(await messageProcessorContract.PROCESSOR_ROLE(), deployment.address);
        console.log("Waiting for PROCESSOR_ROLE transaction...");
        await processorTx.wait(2); // Wait for 2 confirmations

        // Grant VALIDATOR_ROLE with explicit wait
        const targetRegistryContract = await hre.ethers.getContractAt(
            "TargetRegistry",
            targetRegistry.address
        );
        const validatorTx = await targetRegistryContract.connect(adminSigner)
            .grantRole(await targetRegistryContract.VALIDATOR_ROLE(), deployment.address);
        console.log("Waiting for VALIDATOR_ROLE transaction...");
        await validatorTx.wait(2); // Wait for 2 confirmations

        // Verify roles after confirmation
        const hasProcessorRole = await messageProcessorContract.hasRole(
            await messageProcessorContract.PROCESSOR_ROLE(),
            deployment.address
        );
        const hasValidatorRole = await targetRegistryContract.hasRole(
            await targetRegistryContract.VALIDATOR_ROLE(),
            deployment.address
        );

        if (!hasProcessorRole || !hasValidatorRole) {
            throw new Error("Role assignment failed. Roles status: " +
                `PROCESSOR_ROLE: ${hasProcessorRole}, ` +
                `VALIDATOR_ROLE: ${hasValidatorRole}`);
        }

        console.log("Roles successfully granted to MessageRouter");
    }

    // Log deployment information
    console.log("\n=== MessageRouter Deployment Information ===");
    console.log("Network:", await hre.ethers.provider.getNetwork().then(n => `${n.name} (${n.chainId})`));
    console.log("MessageRouter:", deployment.address);
    console.log("\nDependencies:");
    console.log("- Wormhole:", wormhole);
    console.log("- WormholeRelayer:", wormholeRelayer);
    console.log("- TargetRegistry:", targetRegistry.address);
    console.log("- MessageProcessor:", messageProcessor.address);
    console.log("\nDeployer:", admin);
    console.log("=======================================\n");

    if (!isUnitMode()) {
        // 1. Grant MessageProcessor's PROCESSOR_ROLE to the MessageRouter contract
        const messageProcessorContract = await hre.ethers.getContractAt("MessageProcessor", messageProcessor.address);




    }

    return true;
};

func.dependencies = [
    "core",
];

func.id = "MessageRouter";
func.tags = ["market", "MessageRouter"];

export default func;