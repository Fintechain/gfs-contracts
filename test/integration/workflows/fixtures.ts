import { ethers, deployments } from "hardhat";
import { 
    ProtocolCoordinator, MessageRegistry, MessageProtocol, 
    MessageRouter, MessageProcessor, PACS008Handler, SettlementController,
    ERC20Token,
    LiquidityPool
} from "../../../typechain";

export async function deployContractsFixture() {
    const deployResult = await deployments.fixture([
        'PACS008Handler'
    ], {
        keepExistingDeployments: true
    });
    
    // Get contract instances
    let protocolCoordinator = await ethers.getContract<ProtocolCoordinator>("ProtocolCoordinator");
    let messageRegistry = await ethers.getContract<MessageRegistry>("MessageRegistry");
    let messageProtocol = await ethers.getContract<MessageProtocol>("MessageProtocol");
    let messageRouter = await ethers.getContract<MessageRouter>("MessageRouter");
    let messageProcessor = await ethers.getContract<MessageProcessor>("MessageProcessor");
    let messageHandler = await ethers.getContract<PACS008Handler>("PACS008Handler");
    let settlementController = await ethers.getContract<SettlementController>("SettlementController");
    let erc20Token = await ethers.getContract<ERC20Token>("ERC20Token");
    let liquidityPool = await ethers.getContract<LiquidityPool>("LiquidityPool");

    return {
        protocolCoordinator,
        messageRegistry,
        messageProtocol,
        messageRouter,
        messageProcessor,
        messageHandler,
        settlementController,
        erc20Token,
        liquidityPool
    };
}