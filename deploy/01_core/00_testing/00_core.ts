import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

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
