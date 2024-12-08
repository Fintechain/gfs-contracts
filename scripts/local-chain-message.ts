import { ethers } from "hardhat";
import { generatePACS008Payload } from '../src/utils/payload-generator';
import { MESSAGE_TYPE_PACS008 } from '../src/types/';
import { LOCAL_CHAIN_ID } from '../src/constants';

async function main() {
    // Get contract factories
    const ProtocolCoordinator = await ethers.getContractFactory("ProtocolCoordinator");
    const MessageHandler = await ethers.getContractFactory("PACS008Handler");
    const ERC20Token = await ethers.getContractFactory("ERC20Token");
    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    const SettlementController = await ethers.getContractFactory("SettlementController");

    // Get deployed contract addresses
    const COORDINATOR_ADDRESS = "0x7DD8Eec212d57484b4CD28cd934335F5a462BcF7";
    const HANDLER_ADDRESS = "0xd5D108eD8a84fa4e115Bd4Db9e7EaF361FDEB892";
    const TOKEN_ADDRESS = "0xA038894a60f15eb8693E77ef35cA7dF0f2b24aB4";
    const LIQUIDITY_POOL_ADDRESS = "0x7243400FBecD6Af3F43cde9160A5799137C2e22A";
    const SETTLEMENT_CONTROLLER_ADDRESS = "0x71F3717D2d4e843490Ecac3Bc2B515231C3e9397";

    // Validate addresses
    if (!ethers.isAddress(COORDINATOR_ADDRESS)) throw new Error("Invalid coordinator address");
    if (!ethers.isAddress(HANDLER_ADDRESS)) throw new Error("Invalid handler address");
    if (!ethers.isAddress(TOKEN_ADDRESS)) throw new Error("Invalid token address");
    if (!ethers.isAddress(LIQUIDITY_POOL_ADDRESS)) throw new Error("Invalid liquidity pool address");
    if (!ethers.isAddress(SETTLEMENT_CONTROLLER_ADDRESS)) throw new Error("Invalid settlement controller address");

    // Get contract instances
    const protocolCoordinator = await ProtocolCoordinator.attach(COORDINATOR_ADDRESS);
    const messageHandler = await MessageHandler.attach(HANDLER_ADDRESS);
    const erc20Token = await ERC20Token.attach(TOKEN_ADDRESS);
    const liquidityPool = await LiquidityPool.attach(LIQUIDITY_POOL_ADDRESS);
    const settlementController = await SettlementController.attach(SETTLEMENT_CONTROLLER_ADDRESS);

    // Get signers
    const [sender] = await ethers.getSigners();
    const receiverAddress = process.env.RECEIVER_ADDRESS!;
    
    if (!ethers.isAddress(receiverAddress)) throw new Error("Invalid receiver address");

    // Configuration
    const amount = ethers.parseEther(process.env.TRANSFER_AMOUNT || '1.0');

    // Check balances before transfer
    console.log("\nInitial Balances:");
    try {
        const senderBalance = await erc20Token.balanceOf(sender.address);
        const receiverBalance = await erc20Token.balanceOf(receiverAddress);
        const poolBalance = await erc20Token.balanceOf(LIQUIDITY_POOL_ADDRESS);
        
        console.log(`- Sender: ${ethers.formatEther(senderBalance)} tokens`);
        console.log(`- Receiver: ${ethers.formatEther(receiverBalance)} tokens`);
        console.log(`- Liquidity Pool: ${ethers.formatEther(poolBalance)} tokens`);

        // Verify liquidity pool has enough tokens
        if (poolBalance < amount) {
            throw new Error(`Insufficient liquidity in pool. Required: ${ethers.formatEther(amount)}, Available: ${ethers.formatEther(poolBalance)}`);
        }
    } catch (error) {
        console.error("Error checking balances:", error);
        throw error;
    }

    // Create message payload
    const payload = generatePACS008Payload(
        sender.address,
        receiverAddress,
        TOKEN_ADDRESS,
        amount
    );

    // Create submission object
    const submission = {
        messageType: MESSAGE_TYPE_PACS008,
        target: HANDLER_ADDRESS,
        targetChain: LOCAL_CHAIN_ID,
        payload
    };

    // Calculate fees
    let [baseFee, deliveryFee] = [BigInt(0), BigInt(0)];
    try {
        [baseFee, deliveryFee] = await protocolCoordinator.quoteMessageFee(submission);
    } catch (error) {
        console.error("Error calculating fees:", error);
        throw error;
    }

    const totalFee = baseFee + deliveryFee;

    console.log("\nTransaction Details:");
    console.log(`- Amount: ${ethers.formatEther(amount)} tokens`);
    console.log(`- Base Fee: ${ethers.formatEther(baseFee)} ETH`);
    console.log(`- Delivery Fee: ${ethers.formatEther(deliveryFee)} ETH`);
    console.log(`- Total Fee: ${ethers.formatEther(totalFee)} ETH`);

    // Set up event listeners
    const eventPromises: Promise<void>[] = [];
    
    const messageSubmissionPromise = new Promise<void>((resolve) => {
        protocolCoordinator.on("MessageSubmissionInitiated", 
            (messageId, sender, messageType, target, targetChain) => {
            console.log("\nMessage Submission Event:");
            console.log("- Message ID:", messageId);
            console.log("- Sender:", sender);
            console.log("- Message Type:", messageType);
            console.log("- Target:", target);
            console.log("- Target Chain:", targetChain);
            resolve();
        });
    });
    eventPromises.push(messageSubmissionPromise);

    const settlementPromise = new Promise<void>((resolve) => {
        settlementController.on("SettlementStatusUpdated", 
            (settlementId, status) => {
            console.log("\nSettlement Event:");
            console.log("- Settlement ID:", settlementId);
            console.log("- Status:", status);
            resolve();
        });
    });
    eventPromises.push(settlementPromise);

    const transferPromise = new Promise<void>((resolve) => {
        erc20Token.on("Transfer", 
            (from, to, value) => {
            console.log("\nTransfer Event:");
            console.log("- From:", from);
            console.log("- To:", to);
            console.log("- Amount:", ethers.formatEther(value));
            resolve();
        });
    });
    eventPromises.push(transferPromise);

    // Send message
    try {
        console.log("\nSubmitting transaction...");
        const tx = await protocolCoordinator.connect(sender).submitMessage(
            submission,
            { value: totalFee }
        );
        
        console.log("Transaction submitted:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("Transaction confirmed in block:", receipt.blockNumber);

        // Wait for events
        await Promise.race([
            Promise.all(eventPromises),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Event timeout")), 60000))
        ]);

        // Get message result
        const event = receipt.logs.find(
            log => log.topics[0] === protocolCoordinator.interface.getEvent('MessageSubmissionInitiated').topicHash
        );

        if (event) {
            const messageId = event.topics[1];
            const [success, result] = await protocolCoordinator.getMessageResult(messageId);
            
            if (success) {
                const settlementId = ethers.dataSlice(result, 32, 64);
                
                // Get settlement details
                const settlement = await settlementController.getSettlement(settlementId);
                
                console.log("\nSettlement Details:");
                console.log("- Settlement ID:", settlementId);
                console.log("- Status:", settlement.status);
                console.log("- Amount:", ethers.formatEther(settlement.amount));
                console.log("- Recipient:", settlement.recipient);
            } else {
                throw new Error("Message processing failed");
            }
        }

        // Check final balances
        console.log("\nFinal Balances:");
        const finalSenderBalance = await erc20Token.balanceOf(sender.address);
        const finalReceiverBalance = await erc20Token.balanceOf(receiverAddress);
        const finalPoolBalance = await erc20Token.balanceOf(LIQUIDITY_POOL_ADDRESS);
        
        console.log(`- Sender: ${ethers.formatEther(finalSenderBalance)} tokens`);
        console.log(`- Receiver: ${ethers.formatEther(finalReceiverBalance)} tokens`);
        console.log(`- Liquidity Pool: ${ethers.formatEther(finalPoolBalance)} tokens`);

    } catch (error) {
        console.error("\nError processing message:", error);
        
        if (error instanceof Error) {
            // Check for specific error types
            if (error.message.includes("insufficient funds")) {
                console.error("Insufficient funds to pay transaction fees");
            } else if (error.message.includes("user rejected")) {
                console.error("Transaction was rejected by the user");
            } else if (error.message.includes("gas required exceeds allowance")) {
                console.error("Transaction would exceed gas limits");
            }
        }
        
        // Remove event listeners
        protocolCoordinator.removeAllListeners();
        settlementController.removeAllListeners();
        erc20Token.removeAllListeners();
        
        throw error;
    }
}

// Execute
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Script failed:", error);
        process.exit(1);
    });