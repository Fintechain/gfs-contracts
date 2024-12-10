import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { DeploymentHelper } from "../../src/utils/deploy-helper";
import { ERC20Token, LiquidityPool } from "../../typechain";
import { getProtocolConfig } from "../../src/utils/config-helpers";


const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { admin } = await getNamedAccounts();
    const environment = { getNamedAccounts, deployments, ...hre };

    // Initialize helper with protocol config
    const helper = new DeploymentHelper(environment, getProtocolConfig());

    // Get contract instances

    const erc20Token = await helper.getContract<ERC20Token>("ERC20Token");
    const liquidityPool = await helper.getContract<LiquidityPool>("LiquidityPool");

    // Create pool with minimal requirements for testing
    console.log("Creating liquidity pool for ERC20Token...");
    const minLiquidity = hre.ethers.parseUnits("0", 18);  // Set to 0 for testing
    const maxLiquidity = hre.ethers.parseUnits("1000000", 18);  // Keep high max

    const tokenAddr = await erc20Token.getAddress();

    await helper.waitForTx(
        await liquidityPool.createPool(
            tokenAddr,
            minLiquidity,
            maxLiquidity
        )
    );

    console.log(`Created liquidity pool for ERC20Token at ${tokenAddr}`);

    return true;
};

func.id = "CreateLiquidityPools";
func.tags = ["CreateLiquidityPools"];
func.dependencies = ["core"];

export default func;