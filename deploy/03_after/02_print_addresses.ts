import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
    deployments,
    ethers,
}: HardhatRuntimeEnvironment) {
    const network = await ethers.provider.getNetwork();
    const allDeployments = await deployments.all();

    console.log("\n=== Deployed Contract Addresses ===");
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})\n`);

    for (const [name, deployment] of Object.entries(allDeployments)) {
        console.log(`${name.padEnd(35)}: ${deployment.address}`);
    }

    console.log("\n================================\n");
};

func.tags = ["protocol", "print-addresses"];
func.runAtTheEnd = true;

export default func;