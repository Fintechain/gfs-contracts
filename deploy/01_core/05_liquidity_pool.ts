import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "../../src/env";
import { isTestnetMarket, loadProtocolConfig } from "../../src/market-config-helpers";
import { network } from "hardhat";
import { isUnitMode } from "../../src/utils/deploy-helper";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments: { deploy, get },
    ...hre
}: HardhatRuntimeEnvironment) {
    const { admin } = await getNamedAccounts();

    if (isUnitMode()) {
        await deploy("MockLiquidityPool", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
    }

    const liquidityPoolArtifact = await deploy("LiquidityPool", { 
        from: admin, 
        args: [], 
        ...COMMON_DEPLOY_PARAMS 
    });

    // Get contract instances
    const erc20Token = await get("ERC20Token");
    const liquidityPool = await hre.ethers.getContractAt("LiquidityPool", liquidityPoolArtifact.address);

    // Create pool with minimal requirements for testing
    console.log("Creating liquidity pool for ERC20Token...");
    const minLiquidity = hre.ethers.parseUnits("0", 18);  // Set to 0 for testing
    const maxLiquidity = hre.ethers.parseUnits("1000000", 18);  // Keep high max

    const createPoolTx = await liquidityPool.createPool(
        erc20Token.address,
        minLiquidity,
        maxLiquidity
    );
    await createPoolTx.wait();

    console.log(`Created liquidity pool for ERC20Token at ${erc20Token.address}`);

    return true;
};

func.id = "LiquidityPool";
func.tags = ["core", "LiquidityPool"];
func.dependencies = ["tokens"];

export default func;