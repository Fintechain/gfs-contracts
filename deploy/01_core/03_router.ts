import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";
import { ConfigNames, getProtocolConfig, loadProtocolConfig } from "../../src/utils/config-helpers";
import { getContractVariantInstance, isUnitMode } from "../../src/utils/deploy-utils";
import { eEthereumNetwork, eNetwork } from "../../src/types";
import { getWormholeAddresses } from "../../src/utils/wormhole-helper";
import { MessageProcessor, TargetRegistry } from "../../typechain";
import { BaseContract } from "ethers";
import { CONTRACT_VARIANTS } from "../../src/constants/deployment";
import { DeploymentHelper } from "../../src/utils/deploy-helper";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get, log } = deployments;
    const { admin } = await getNamedAccounts();
    //const config = loadProtocolConfig(MARKET_NAME);
    const config = getProtocolConfig();
    const adminSigner = await hre.ethers.getSigner(admin);
    const environment = { getNamedAccounts, deployments, ...hre };

    const network = (
        process.env.FORK ? process.env.FORK : hre.network.name
    ) as eNetwork;

    var { wormholeRelayer, wormhole } = getWormholeAddresses(network, config);

    // Initialize helper with protocol config
    const helper = new DeploymentHelper(environment, getProtocolConfig());

    // Get contract instances using helper
    const targetRegistry = await helper.getContractVariantInstance<TargetRegistry>(
        CONTRACT_VARIANTS.TargetRegistry
    );

    const messageProcessor = await helper.getContractVariantInstance<MessageProcessor>(
        CONTRACT_VARIANTS.MessageProcessor
    );

    // Get addresses
    const targetRegistryAddr = await targetRegistry.getAddress();
    const messageProcessorAddr = await messageProcessor.getAddress();

    const deployment = await deploy("MessageRouter", {
        from: admin,
        args: [
            wormholeRelayer,
            wormhole,
            targetRegistryAddr,
            messageProcessorAddr
        ],
        ...COMMON_DEPLOY_PARAMS
    });

    if (!isUnitMode()) {
        // 1. Grant MessageProcessor's PROCESSOR_ROLE to the MessageRouter contract
        await helper.waitForTx(
            await messageProcessor.connect(
                adminSigner).grantRole(await messageProcessor.PROCESSOR_ROLE(), deployment.address)
        );
        // 2. Grant TargetRegistry's VALIDATOR_ROLE to the MessageRouter contract
        await helper.waitForTx(
            await targetRegistry.connect(
                adminSigner).grantRole(await targetRegistry.VALIDATOR_ROLE(), deployment.address)
        );

        console.log("MessageRouter has PROCESSOR_ROLE in MessageProcessor:",
            await messageProcessor.hasRole(await messageProcessor.PROCESSOR_ROLE(), deployment.address)
        );

        console.log("MessageRouter has VALIDATOR_ROLE in TargetRegistry:",
            await targetRegistry.hasRole(await targetRegistry.VALIDATOR_ROLE(), deployment.address)
        );
    }

    // Log deployment information
    console.log("\n=== MessageRouter Deployment Information ===");
    console.log("Network:", await hre.ethers.provider.getNetwork().then(n => `${n.name} (${n.chainId})`));
    console.log("MessageRouter:", deployment.address);
    console.log("\nDependencies:");
    console.log("- Wormhole:", wormhole);
    console.log("- WormholeRelayer:", wormholeRelayer);
    console.log("- TargetRegistry:", targetRegistryAddr);
    console.log("- MessageProcessor:", messageProcessorAddr);
    console.log("\nDeployer:", admin);
    console.log("===============================================\n");


    return true;
};

func.dependencies = [
    "core",
];

func.id = "MessageRouter";
func.tags = ["market", "MessageRouter"];

export default func;