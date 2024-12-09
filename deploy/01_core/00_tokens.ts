import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { COMMON_DEPLOY_PARAMS } from "../../src/env";
import { ERC20Token } from "../../typechain";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { admin } = await getNamedAccounts();

    const defaultAdmin = admin; 
    const pauser = admin;
    const minter = admin;
    const upgrader = admin;

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

    const mintTx = await (tokenWithMinter as ERC20Token).mint(admin, amountToMint);
    //await mintTx.wait();

    console.log(`Minted ${hre.ethers.formatUnits(amountToMint, 18)} tokens to ${admin}`);

    // Verify balance
    const balance = await (token as ERC20Token).balanceOf(admin);
    console.log(`Initial supply: ${hre.ethers.formatUnits(balance, 18)} GFSUSD`);

    deploy("LiquidStakingToken", {
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

    return true;
};

func.id = "ProtocolTokens";
func.tags = ["tokens", "ProtocolTokens"];

export default func;