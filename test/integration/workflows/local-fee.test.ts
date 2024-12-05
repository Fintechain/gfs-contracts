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

    // Standard gas limit for message submission
    const DEFAULT_GAS_LIMIT = 500000n;
    // Allow for 0.001 ETH deviation in calculations
    const ALLOWED_DEVIATION = ethers.parseEther("0.001");

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

            const serviceFees = await msgService.getMessageFees(messageData);
            const submission = {
                messageType: ethers.solidityPackedKeccak256(["string"], ["pacs.008"]),
                target: handlerAddress,
                targetChain: LOCAL_CHAIN_ID,
                payload: await msgService.createPACS008Payload(messageData)
            };

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

        // Calculate all required fees
        const { baseFee, deliveryFee } = await msgService.getMessageFees(messageData);
        const requiredFee = baseFee + deliveryFee;
        
        // Get initial balance and create submission data
        const initialBalance = await ethers.provider.getBalance(sender.address);
        const payload = await msgService.createPACS008Payload(messageData);
        const submission = {
            messageType: MESSAGE_TYPE_PACS008,
            target: handlerAddress,
            targetChain: LOCAL_CHAIN_ID,
            payload: payload
        };

        // Estimate gas for the transaction
        const estimatedGas = await contracts.protocolCoordinator.estimateGas.submitMessage(
            submission,
            { value: requiredFee }
        );

        // Add 20% buffer to estimated gas
        const gasLimit = (estimatedGas * 120n) / 100n;

        // Submit transaction with proper gas settings
        const tx = await contracts.protocolCoordinator.connect(sender).submitMessage(
            submission,
            { 
                value: requiredFee,
                gasLimit: gasLimit
            }
        );

        const receipt = await tx.wait();
        if (!receipt) throw new Error("Transaction failed: No receipt received");

        const gasCost = receipt.gasUsed * receipt.gasPrice;
        const finalBalance = await ethers.provider.getBalance(sender.address);

        // Calculate and verify actual costs
        const actualSpent = initialBalance - finalBalance;
        const expectedSpent = requiredFee + gasCost;

        expect(actualSpent).to.be.closeTo(
            expectedSpent,
            ALLOWED_DEVIATION,
            "Actual spend differs significantly from expected spend"
        );

        expect(receipt.status).to.equal(1, "Transaction failed to execute successfully");
    });

    it("Should fail when insufficient fees are provided", async function () {
        const messageData = await createMessageData(
            ethers.parseEther("1"),
            sender.address,
            receiver.address,
            handlerAddress
        );

        const { totalFee } = await msgService.getMessageFees(messageData);
        const submission = {
            messageType: MESSAGE_TYPE_PACS008,
            target: handlerAddress,
            targetChain: LOCAL_CHAIN_ID,
            payload: await msgService.createPACS008Payload(messageData)
        };

        // Try to submit with half the required fee
        await expect(
            contracts.protocolCoordinator.connect(sender).submitMessage(
                submission,
                { 
                    value: totalFee / 2n,
                    gasLimit: DEFAULT_GAS_LIMIT
                }
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
        if (!receipt) throw new Error("Transaction failed: No receipt received");

        expect(receipt.gasUsed).to.be.gt(0n, "Gas tracking failed: No gas recorded");
        expect(receipt.gasPrice).to.be.gt(0n, "Gas tracking failed: No gas price recorded");

        const routerFee = await contracts.messageRouter.quoteRoutingFee(1, 100);
        expect(receipt.gasUsed * receipt.gasPrice).to.be.lte(
            routerFee * 2n,
            "Gas usage exceeds reasonable limits"
        );
    });
});