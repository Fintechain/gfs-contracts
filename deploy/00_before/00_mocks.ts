import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { COMMON_DEPLOY_PARAMS } from "../../src/env";
import { isUnitMode } from "../../src/utils/deploy-utils";

const func: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
    ...hre
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments;
    const { admin } = await getNamedAccounts();

    if (isUnitMode()) {
        await deploy("MockMessageProtocol", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
        await deploy("MockMessageRegistry", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
        await deploy("MockTargetRegistry", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
        await deploy("MockMessageProcessor", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
        await deploy("MockWormhole", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
        await deploy("MockWormholeRelayer", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
        await deploy("MockLiquidityPool", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
        await deploy("MockSettlementController", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });
        await deploy("MockMessageRouter", { from: admin, args: [], ...COMMON_DEPLOY_PARAMS });

        await deploy("MockERC20Token", {
            from: admin, contract: "MockERC20Token",
            args: ["Mock Token", "MOCK"], ...COMMON_DEPLOY_PARAMS
        });


        await deploy("MockTargetToken", {
            from: admin, contract: "MockERC20Token",
            args: ["Mock Target Token", "MTT"], ...COMMON_DEPLOY_PARAMS
        });
    }

    return true;
};

func.id = "MockContracts";
func.tags = ["mocks", "MockContracts"];

export default func;
