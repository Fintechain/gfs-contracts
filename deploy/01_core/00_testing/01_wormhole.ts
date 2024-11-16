import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    await deploy("MockWormhole", { from: admin, args: [], log: true });
    await deploy("MockWormholeRelayer", { from: admin, args: [], log: true });

    return true;
};

func.id = "WormholeMocks";
func.tags = ["WormholeMocks", "local", "mocks", "wormhole"];

export default func;
