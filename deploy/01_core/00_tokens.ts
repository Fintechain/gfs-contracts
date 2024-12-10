import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { COMMON_DEPLOY_PARAMS } from "../../src/env";
import { ERC20Token } from "../../typechain";
import { DeploymentHelper } from "../../src/utils/deploy-helper";
import { getProtocolConfig } from "../../src/utils/config-helpers";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { admin } = await getNamedAccounts();
    const environment = { getNamedAccounts, deployments, ...hre };

    // Initialize helper with protocol config
    const helper = new DeploymentHelper(environment, getProtocolConfig());

    const defaultAdmin = admin;
    const pauser = admin;
    const minter = admin;
    const upgrader = admin;

    // Deploy ERC20Token
    const eRC20TokenArtifact = await deploy("ERC20Token", {
        from: admin,
        proxy: {
            proxyContract: "OpenZeppelinTransparentProxy",
            execute: {
                init: {
                    methodName: "initialize",
                    args: ["GFS Dollar", "GFSUSD", defaultAdmin, pauser, minter],
                },
            },
        },
        ...COMMON_DEPLOY_PARAMS
    });

    // Deploy LiquidStakingToken
    await deploy("LiquidStakingToken", {
        from: admin,
        proxy: {
            proxyContract: "OpenZeppelinTransparentProxy",
            execute: {
                init: {
                    methodName: "initialize",
                    args: ["Staked GFS Dollar", "SGFSUSD", eRC20TokenArtifact.address, defaultAdmin, minter, upgrader],
                },
            },
        },
        ...COMMON_DEPLOY_PARAMS
    });

    // Deploy GovernanceToken
    await deploy("GovernanceToken", {
        from: admin,
        proxy: {
            proxyContract: "OpenZeppelinTransparentProxy",
            execute: {
                init: {
                    methodName: "initialize",
                    args: ["GFS Coin", "GFSC", defaultAdmin, pauser, minter, upgrader],
                },
            },
        },
        ...COMMON_DEPLOY_PARAMS
    });

    const minterSigner = await hre.ethers.getSigner(minter);
    const amountToMint = hre.ethers.parseUnits("1000000", 18);

    // Get deployed token
    const token = await helper.getContract<ERC20Token>("ERC20Token");

    console.log("Minting initial supply...");

    await helper.waitForTx(
        await token.connect(minterSigner).mint(admin, amountToMint)
    );

    console.log(`Minted ${hre.ethers.formatUnits(amountToMint, 18)} tokens to ${admin}`);

    // Verify balance
    const balance = await (token as ERC20Token).balanceOf(admin);

    console.log(`Initial supply: ${hre.ethers.formatUnits(balance, 18)} ${await token.symbol()}`);

    return true;
};

func.id = "ProtocolTokens";
func.tags = ["tokens", "ProtocolTokens"];

export default func;