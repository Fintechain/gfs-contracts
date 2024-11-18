import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const { admin } = await getNamedAccounts();

    // Get mock addresses - in the correct order per constructor
    const mockWormholeRelayer = (await get("MockWormholeRelayer")).address;
    const mockWormhole = (await get("MockWormhole")).address;
    const mockTargetRegistry = (await get("MockTargetRegistry")).address;
    const mockMessageProcessor = (await get("MockMessageProcessor")).address;

    // Deploy test version of MessageRouter with mocks
    const deployment = await deploy("MessageRouter", {
        from: admin,  // admin will automatically get all roles
        args: [
            mockWormholeRelayer,    // _wormholeRelayer: IWormholeRelayer
            mockWormhole,           // _wormhole: IWormhole
            mockTargetRegistry,     // _targetRegistry: ITargetRegistry
            mockMessageProcessor    // _messageProcessor: IMessageProcessor
        ],
        log: true,
        waitConfirmations: 1
    });

    // Configure mock states if needed
    if (deployment.newlyDeployed) {
        const mockWormholeContract = await hre.ethers.getContractAt("MockWormhole", mockWormhole);
        await mockWormholeContract.setMessageFee(hre.ethers.parseEther("0.001"));
    }

    console.log("MessageRouter deployed to:", deployment.address);
    console.log("Dependencies:");
    console.log(" - WormholeRelayer:", mockWormholeRelayer);
    console.log(" - Wormhole:", mockWormhole);
    console.log(" - TargetRegistry:", mockTargetRegistry);
    console.log(" - MessageProcessor:", mockMessageProcessor);

    return true;
};

// Dependencies - make sure all required mocks are deployed first
func.dependencies = ["mocks", "WormholeMocks"];

// Use different tags for the test version
func.id = "MessageRouter_Test";
func.tags = ["MessageRouter_Test"];

// Skip this deployment in production
func.skip = async (hre) => {
    // Skip if not in test environment
    return hre.network.name !== "hardhat" && hre.network.name !== "localhost";
};

export default func;