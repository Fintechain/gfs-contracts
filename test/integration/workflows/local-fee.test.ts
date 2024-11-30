import { expect } from "chai";
import { ethers } from "hardhat";
import {
    ProtocolCoordinator,
    MessageRegistry,
    MessageProtocol,
    MessageRouter,
    MessageProcessor,
    PACS008Handler,
    SettlementController,
} from "../../../typechain";
import { deployContractsFixture } from "./fixture";
import { PACS008MessageServiceImpl } from "../../../src/services/pacs008-message.service";
import {
    TEST_CONSTANTS,
    createMessageData,
    submitAndVerifyMessage,
} from "../../helpers/pacs008.helper";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MESSAGE_TYPE_PACS008 } from "../../../src/types/";
import { LOCAL_CHAIN_ID } from "../../../src/constants";

describe("PACS008 Fee-Related Integration Tests", function () {
    let contracts: {
        protocolCoordinator: ProtocolCoordinator;
        messageRegistry: MessageRegistry;
        messageProtocol: MessageProtocol;
        messageRouter: MessageRouter;
        messageProcessor: MessageProcessor;
        messageHandler: PACS008Handler;
        settlementController: SettlementController;
    };

    let admin: SignerWithAddress;
    let sender: SignerWithAddress;
    let receiver: SignerWithAddress;
    let handlerAddress: string;
    let msgService: PACS008MessageServiceImpl;

    beforeEach(async function () {
        contracts = await deployContractsFixture();
        const signers = await ethers.getSigners();
        [admin, sender, receiver] = signers;

        handlerAddress = await contracts.messageHandler.getAddress();
        
        msgService = new PACS008MessageServiceImpl(
            contracts.protocolCoordinator,
            LOCAL_CHAIN_ID
        );
    });

    it("Should calculate correct fees for different payload sizes", async function () {
        const amounts = [
            ethers.parseEther("1"),
            ethers.parseEther("1000"),
            ethers.parseEther("0.000001"),
        ];

        for (const amount of amounts) {
            const messageData = await createMessageData(
                amount,
                sender.address,
                receiver.address,
                handlerAddress
            );

            // Get service fees
            const serviceFees = await msgService.getMessageFees(messageData);

            // Create submission for protocol coordinator
            const submission = {
                messageType: ethers.solidityPackedKeccak256(["string"], ["pacs.008"]),
                target: handlerAddress,
                targetChain: LOCAL_CHAIN_ID,
                payload: await msgService.createPACS008Payload(messageData)
            };

            // Get protocol fees directly
            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);
            const totalProtocolFee = baseFee + deliveryFee;

            expect(serviceFees.totalFee).to.equal(totalProtocolFee,
                `Fee calculation incorrect for amount ${ethers.formatEther(amount)} ETH`);
        }
    });

    it("Should refund excess fees correctly", async function () {
        const messageData = await createMessageData(
            ethers.parseEther("1"),
            sender.address,
            receiver.address,
            handlerAddress
        );

        // Get service instance and calculate fees
        const { baseFee, deliveryFee } = await msgService.getMessageFees(messageData);
        const requiredFee = baseFee + deliveryFee;
        
        const initialBalance = await ethers.provider.getBalance(sender.address);

        // Create submission with proper payload
        const payload = await msgService.createPACS008Payload(messageData);

        // Create submission data
        const submission = {
            messageType: MESSAGE_TYPE_PACS008,
            target: handlerAddress,
            targetChain: LOCAL_CHAIN_ID,
            payload: payload
        };

        // Submit with exact fee (the protocol handles refunds internally)
        const tx = await contracts.protocolCoordinator.connect(sender).submitMessage(
            submission,
            { value: requiredFee }
        );

        // Wait for transaction
        const receipt = await tx.wait();
        if (!receipt) throw new Error("No receipt received");

        // Calculate gas cost
        const gasCost = receipt.gasUsed * receipt.gasPrice;
        const finalBalance = await ethers.provider.getBalance(sender.address);

        // Calculate actual spent
        const actualSpent = initialBalance - finalBalance;
        const expectedSpent = requiredFee + gasCost;

        /* console.log("Fee Test Details:");
        console.log(`Initial Balance: ${ethers.formatEther(initialBalance)} ETH`);
        console.log(`Final Balance: ${ethers.formatEther(finalBalance)} ETH`);
        console.log(`Base Fee: ${ethers.formatEther(baseFee)} ETH`);
        console.log(`Delivery Fee: ${ethers.formatEther(deliveryFee)} ETH`);
        console.log(`Required Fee: ${ethers.formatEther(requiredFee)} ETH`);
        console.log(`Gas Cost: ${ethers.formatEther(gasCost)} ETH`);
        console.log(`Actual Spent: ${ethers.formatEther(actualSpent)} ETH`);
        console.log(`Expected Spent: ${ethers.formatEther(expectedSpent)} ETH`);
        console.log(`Difference: ${ethers.formatEther(actualSpent - expectedSpent)} ETH`); */

        // Verify actual spent matches expected (required fee + gas)
        const allowedDeviation = ethers.parseEther("0.0001"); // 0.0001 ETH deviation allowed
        expect(actualSpent).to.be.closeTo(
            expectedSpent,
            allowedDeviation,
            "Actual spend differs from expected spend (required fee + gas cost)"
        );

        // Verify the transaction was successful
        expect(receipt.status).to.equal(1, "Transaction failed");
    });

    it("Should fail when insufficient fees are provided", async function () {
        const messageData = await createMessageData(
            ethers.parseEther("1"),
            sender.address,
            receiver.address,
            handlerAddress
        );

        const { totalFee } = await msgService.getMessageFees(messageData);

        // Try to submit with insufficient fee directly to the contract
        await expect(
            contracts.protocolCoordinator.connect(sender).submitMessage(
                {
                    messageType: ethers.solidityPackedKeccak256(["string"], ["pacs.008"]),
                    target: handlerAddress,
                    targetChain: LOCAL_CHAIN_ID,
                    payload: await msgService.createPACS008Payload(messageData)
                },
                { value: totalFee / 2n } // Half the required fee
            )
        ).to.be.revertedWith("Insufficient fee");
    });

    it("Should track gas usage correctly for local message processing", async function () {
        const messageData = await createMessageData(
            ethers.parseEther("1"),
            sender.address,
            receiver.address,
            handlerAddress
        );

        const { response } = await submitAndVerifyMessage(messageData, admin, msgService);
        const receipt = await response.transaction.wait(1);
        if (!receipt) throw new Error("No receipt received");

        expect(receipt.gasUsed).to.be.gt(0n, "Gas used should be recorded");
        expect(receipt.gasPrice).to.be.gt(0n, "Gas price should be recorded");

        const routerFee = await contracts.messageRouter.quoteRoutingFee(1, 100);
        expect(receipt.gasUsed * receipt.gasPrice).to.be.lte(
            routerFee * 2n,
            "Gas usage should be reasonable"
        );

        /* console.log("Gas Usage Statistics:");
        console.log(`- Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`- Gas Price: ${ethers.formatUnits(receipt.gasPrice, 'gwei')} gwei`);
        console.log(`- Total Gas Cost: ${ethers.formatEther(receipt.gasUsed * receipt.gasPrice)} ETH`); */
    });
});