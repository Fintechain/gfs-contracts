import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy, get } = deployments;
    const { admin, operator, emergencyAdmin } = await getNamedAccounts();

    // Get mock addresses
    const messageRegistry = (await get("MockMessageRegistry")).address;
    const messageProtocol = (await get("MockMessageProtocol")).address;
    const messageRouter = (await get("MockMessageRouter")).address;
    const messageProcessor = (await get("MockMessageProcessor")).address;

    // Deploy test version of ProtocolCoordinator with mocks
    const deployment = await deploy("ProtocolCoordinator", {
        from: admin,
        args: [
            messageRegistry,
            messageProtocol,
            messageRouter,
            messageProcessor,
        ],
        log: true,
        waitConfirmations: 1
    });

    // Set up roles if this is a fresh deployment
    if (deployment.newlyDeployed) {
        const protocolCoordinator = await hre.ethers.getContractAt(
            "ProtocolCoordinator",
            deployment.address
        );

        // Grant roles
        const adminSigner = await hre.ethers.getSigner(admin);
        await protocolCoordinator.connect(adminSigner).grantRole(
            await protocolCoordinator.OPERATOR_ROLE(),
            operator
        );
        await protocolCoordinator.connect(adminSigner).grantRole(
            await protocolCoordinator.EMERGENCY_ROLE(),
            emergencyAdmin
        );
    }

    return true;
};

// Dependencies - make sure mocks are deployed first
func.dependencies = ["mocks"];

// Use different tags for the test version
func.id = "ProtocolCoordinator_Test";
func.tags = ["ProtocolCoordinator_Test"];

// Skip this deployment in production
func.skip = async (hre) => {
    // Skip if not in test environment
    return hre.network.name !== "hardhat" && hre.network.name !== "localhost";
};

export default func;