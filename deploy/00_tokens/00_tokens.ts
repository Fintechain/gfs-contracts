import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { LOG_DEPLOYMENTS } from "../../src/";
import { isTestnetMarket, loadProtocolConfig } from "../../src/market-config-helpers";
import { COMMON_DEPLOY_PARAMS, MARKET_NAME } from "./../../src/env";
import { network } from "hardhat";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { admin } = await getNamedAccounts();

    const defaultAdmin = admin; // or any other address you want to set as default admin
    const pauser = admin; // or any other address you want to set as pauser
    const minter = admin; // or any other address you want to set as minter
    const upgrader = admin; // or any other address you want to set as upgrader

    if (!network.live) {
        await deploy("MockERC20Token", {
            from: admin,
            contract: "MockERC20Token",
            args: ["Mock Token", "MOCK"],
            ...COMMON_DEPLOY_PARAMS
        });


        await deploy("MockTargetToken", {
            from: admin,
            contract: "MockERC20Token",
            args: ["Mock Target Token", "MTT"],
            ...COMMON_DEPLOY_PARAMS
        });
    }


    // Your existing deployment code
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

    // Get contract instance at proxy address
    const ERC20Token = await hre.ethers.getContractFactory("ERC20Token");
    const token = await ERC20Token.attach(eRC20TokenArtifact.address);

    // Get minter signer and connect to contract
    const minterSigner = await hre.ethers.getSigner(minter);
    const tokenWithMinter = token.connect(minterSigner);

    // Mint initial supply
    const amountToMint = hre.ethers.parseUnits("1000000", 18);
    console.log("Minting initial supply...");

    const mintTx = await tokenWithMinter.mint(admin, amountToMint);
    await mintTx.wait();

    console.log(`Minted ${hre.ethers.formatUnits(amountToMint, 18)} tokens to ${admin}`);

    // Verify balance
    const balance = await token.balanceOf(admin);
    console.log(`Initial supply: ${hre.ethers.formatUnits(balance, 18)} GFSUSD`);

    const liquidStakingTokenImplArtifact = await deploy("LiquidStakingToken", {
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

    const governanceTokenArtifact = await deploy("GovernanceToken", {
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

    return true;
};

func.id = "ProtocolTokens";
func.tags = ["tokens", "ProtocolTokens"];

export default func;