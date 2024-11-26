import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { MessageRouter } from "../../typechain";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";
import { isTestnetMarket, loadProtocolConfig } from "../../src/market-config-helpers";
import { network } from "hardhat";
import { getDeploymentMode, isUnitMode } from "../../src/utils/deploy-helper";

// Goerli testnet addresses - we'll use these for local hardhat node
const WORMHOLE_ADDRESSES = {
    wormhole: "0x706abc4E45D419950511e474C7B9Ed348A4a716c",
    wormholeRelayer: "0x28D8F1Be96f97C1387e94A53e00eCcFb4E75175a"
};

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const { admin } = await getNamedAccounts();
    const adminSigner = await hre.ethers.getSigner(admin);

    // Get dependency addresses
    var wormhole;
    var wormholeRelayer;
    var targetRegistry;
    var messageProcessor;

    if (isUnitMode()) {

        await deploy("MockMessageRouter", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });

        wormhole = (await get("MockWormhole")).address;
        wormholeRelayer = ((await get("MockWormholeRelayer")).address);
        /*  wormhole = WORMHOLE_ADDRESSES.wormhole
         wormholeRelayer = WORMHOLE_ADDRESSES.wormholeRelayer; */

        targetRegistry = await get("MockTargetRegistry");
        messageProcessor = await get("MockMessageProcessor");

    }
    else {
        wormhole = WORMHOLE_ADDRESSES.wormhole
        wormholeRelayer = WORMHOLE_ADDRESSES.wormholeRelayer;

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

    if (!isUnitMode()) {
        // 1. Grant MessageProcessor's PROCESSOR_ROLE to the MessageRouter contract
        const messageProcessorContract = await hre.ethers.getContractAt("MessageProcessor", messageProcessor.address);
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
    }

    // Log deployment information
    console.log("\n=== MessageRouter Deployment Information ===");
    console.log("Network:", await hre.ethers.provider.getNetwork().then(n => `${n.name} (${n.chainId})`));
    console.log("MessageRouter:", deployment.address);
    console.log("\nDependencies:");
    console.log("- WormholeRelayer:", WORMHOLE_ADDRESSES.wormholeRelayer);
    console.log("- Wormhole:", WORMHOLE_ADDRESSES.wormhole);
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