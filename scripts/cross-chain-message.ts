import { ethers } from "hardhat";
import { generatePACS008Payload } from "../src/utils/payload-generator";
import { MESSAGE_TYPE_PACS008 } from "../src/types";
import { LOCAL_CHAIN_ID } from "../src/constants";

async function main() {
    const [sender, receiver] = await ethers.getSigners();

    console.log("Sending message from:", sender.address);
    console.log("Receiver:", receiver.address);

    // Get contract instances
    const protocolCoordinator = await ethers.getContract("ProtocolCoordinator");
    const messageHandler = await ethers.getContract("PACS008Handler");
    const erc20Token = await ethers.getContract("ERC20Token");
    const liquidityPool = await ethers.getContract("LiquidityPool");

    // Setup liquidity
    const liquidityAmount = ethers.parseEther("10.0");
    const messageAmount = ethers.parseEther("1.0");

    console.log("\nSetting up liquidity...");
    await erc20Token.mint(sender.address, liquidityAmount);
    await erc20Token.connect(sender).approve(liquidityPool.getAddress(), liquidityAmount);
    await liquidityPool.connect(sender).addLiquidity(erc20Token.getAddress(), liquidityAmount);
    console.log("Added liquidity:", ethers.formatEther(liquidityAmount), "tokens");

    // Generate message payload
    const payload = generatePACS008Payload(
        sender.address,
        receiver.address,
        erc20Token.getAddress(),
        messageAmount
    );

    const submission = {
        messageType: MESSAGE_TYPE_PACS008,
        target: await messageHandler.getAddress(),
        targetChain: LOCAL_CHAIN_ID,
        payload
    };

    // Calculate fees
    const [baseFee, deliveryFee] = await protocolCoordinator.quoteMessageFee(submission);
    const totalFee = baseFee + deliveryFee;

    console.log("\nSubmitting message...");
    console.log("Base fee:", ethers.formatEther(baseFee));
    console.log("Delivery fee:", ethers.formatEther(deliveryFee));

    // Submit message
    const tx = await protocolCoordinator.connect(sender).submitMessage(
        submission,
        { value: totalFee }
    );

    console.log("Transaction submitted:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);

    // Get message ID from event
    const event = receipt.logs.find(
        log => log.topics[0] === protocolCoordinator.interface.getEvent('MessageSubmissionInitiated').topicHash
    );
    const messageId = event?.topics[1];
    console.log("Message ID:", messageId);

    // Check result
    const [success, result] = await protocolCoordinator.getMessageResult(messageId);
    console.log("\nMessage processing result:");
    console.log("Success:", success);
    console.log("Result:", result);

    // Check balances
    const receiverBalance = await erc20Token.balanceOf(receiver.address);
    console.log("\nFinal balances:");
    console.log("Receiver balance:", ethers.formatEther(receiverBalance));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });