import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ethers,
    ...hre
}: HardhatRuntimeEnvironment) {
    /* const { execute } = deployments;
    const { deployer, platformAdmin } = await getNamedAccounts();

    const accountManagerDeployment = await deployments.get("AccountManager");
    const participantRegistry = await deployments.get("ParticipantRegistry");

    // Initialize ContractA with ContractB's address
    await execute(
        "TransactionManager", { from: deployer, log: true },
        "initialize", platformAdmin, participantRegistry.address, accountManagerDeployment.address
    ); */

    return true;
};

func.id = "InitContracts";
func.tags = ["core", "InitContracts"];

export default func;
