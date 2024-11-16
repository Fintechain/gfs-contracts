import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { liquidityPoolAdmin } = await getNamedAccounts();

    await deploy("LiquidityPool", {
        from: liquidityPoolAdmin,
        args: [],
        log: true,
    });

    return true;
};

func.id = "LiquidityPool";
func.tags = ["core", "local", "LiquidityPool"];

export default func;
