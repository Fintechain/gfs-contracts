import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // Deploy mock tokens first
    await deploy("MockToken", {
        from: admin,
        args: ["Mock Token", "MOCK"],
        contract: "MockToken",
        log: true,
    });

    // Deploy target token with different parameters for testing
    await deploy("MockTargetToken", {
        from: admin,
        args: ["Mock Target Token", "MTT"],
        contract: "MockToken", // Note: Using same MockToken contract
        log: true,
    });

    // Deploy other mocks
    await deploy("MockLiquidityPool", { from: admin, args: [], log: true });
    await deploy("MockMessageHandler", { from: admin, args: [], log: true });
    await deploy("MockMessageRegistry", { from: admin, args: [], log: true });
    await deploy("MockMessageProcessor", { from: admin, args: [], log: true });
    await deploy("MockMessageRouter", { from: admin, args: [], log: true });
    await deploy("MockMessageProtocol", { from: admin, args: [], log: true });
    await deploy("MockSettlementController", { from: admin, args: [], log: true });
    await deploy("MockTargetRegistry", { from: admin, args: [], log: true });

    return true;
};

func.id = "CoreMocks";
func.tags = ["core", "local", "mocks"];

export default func;