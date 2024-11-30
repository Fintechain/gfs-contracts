/* import { expect } from "chai";
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
    verifyStateTransitions
} from "../../helpers/pacs008.helper";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MessageSubmissionError } from "../../../src/types/message-service";

describe("PACS008 Cross-Chain Message Processing", function () {
    // Test constants for cross-chain scenarios
    const CROSS_CHAIN_CONSTANTS = {
        POLYGON_CHAIN_ID: 137,
        ARBITRUM_CHAIN_ID: 42161,
        OPTIMISM_CHAIN_ID: 10,
        GAS_LIMIT_POLYGON: 500000n,
        GAS_LIMIT_ARBITRUM: 1000000n,
        GAS_LIMIT_OPTIMISM: 750000n
    };

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
    let emergencyAdmin: SignerWithAddress;
    let handlerAddress: string;
    let polygonMsgService: PACS008MessageServiceImpl;
    let arbitrumMsgService: PACS008MessageServiceImpl;
    let optimismMsgService: PACS008MessageServiceImpl;

    beforeEach(async function () {
        contracts = await deployContractsFixture();
        
        const signers = await ethers.getSigners();
        [admin, sender, receiver, emergencyAdmin] = signers;
        
        // Setup roles
        await contracts.protocolCoordinator.grantRole(
            await contracts.protocolCoordinator.EMERGENCY_ROLE(),
            emergencyAdmin.address
        );

        // Initialize cross-chain services
        handlerAddress = await contracts.messageHandler.getAddress();
        polygonMsgService = new PACS008MessageServiceImpl(
            contracts.protocolCoordinator,
            CROSS_CHAIN_CONSTANTS.POLYGON_CHAIN_ID
        );
        arbitrumMsgService = new PACS008MessageServiceImpl(
            contracts.protocolCoordinator,
            CROSS_CHAIN_CONSTANTS.ARBITRUM_CHAIN_ID
        );
        optimismMsgService = new PACS008MessageServiceImpl(
            contracts.protocolCoordinator,
            CROSS_CHAIN_CONSTANTS.OPTIMISM_CHAIN_ID
        );

        // Setup chain gas limits
        await contracts.messageRouter.connect(admin).setChainGasLimit(
            CROSS_CHAIN_CONSTANTS.POLYGON_CHAIN_ID,
            CROSS_CHAIN_CONSTANTS.GAS_LIMIT_POLYGON
        );
        await contracts.messageRouter.connect(admin).setChainGasLimit(
            CROSS_CHAIN_CONSTANTS.ARBITRUM_CHAIN_ID,
            CROSS_CHAIN_CONSTANTS.GAS_LIMIT_ARBITRUM
        );
        await contracts.messageRouter.connect(admin).setChainGasLimit(
            CROSS_CHAIN_CONSTANTS.OPTIMISM_CHAIN_ID,
            CROSS_CHAIN_CONSTANTS.GAS_LIMIT_OPTIMISM
        );
    });

    describe("Cross-Chain Message Submission", () => {
        it("Should submit messages to different chains with correct chain IDs", async function () {
            const messageData = await createMessageData(
                ethers.parseEther("1"),
                sender.address,
                receiver.address,
                handlerAddress
            );

            // Submit to Polygon
            const polygonResult = await submitAndVerifyMessage(messageData, sender, polygonMsgService);
            const polygonMessage = await contracts.messageRegistry.getMessage(polygonResult.messageId);
            expect(Number(polygonMessage.targetChain)).to.equal(CROSS_CHAIN_CONSTANTS.POLYGON_CHAIN_ID);

            // Submit to Arbitrum
            const arbitrumResult = await submitAndVerifyMessage(messageData, sender, arbitrumMsgService);
            const arbitrumMessage = await contracts.messageRegistry.getMessage(arbitrumResult.messageId);
            expect(Number(arbitrumMessage.targetChain)).to.equal(CROSS_CHAIN_CONSTANTS.ARBITRUM_CHAIN_ID);
        });

        it("Should maintain message in PENDING state for cross-chain messages", async function () {
            const messageData = await createMessageData(
                ethers.parseEther("1"),
                sender.address,
                receiver.address,
                handlerAddress
            );

            const { messageId } = await submitAndVerifyMessage(messageData, sender, polygonMsgService);
            
            const status = await contracts.messageRegistry.getMessageStatus(messageId);
            expect(status).to.equal(0); // PENDING
        });

        it("Should allow cancellation of pending cross-chain messages", async function () {
            const messageData = await createMessageData(
                ethers.parseEther("1"),
                sender.address,
                receiver.address,
                handlerAddress
            );

            const { messageId } = await submitAndVerifyMessage(messageData, sender, polygonMsgService);
            
            // Cancel the pending message
            await contracts.protocolCoordinator.connect(sender).cancelMessage(messageId);
            
            const status = await contracts.messageRegistry.getMessageStatus(messageId);
            expect(status).to.equal(5); // CANCELLED
        });
    });

    describe("Cross-Chain Fee Management", () => {
        it("Should calculate correct cross-chain fees based on target chain", async function () {
            const messageData = await createMessageData(
                ethers.parseEther("1"),
                sender.address,
                receiver.address,
                handlerAddress
            );

            const polygonFees = await polygonMsgService.getMessageFees(messageData);
            const arbitrumFees = await arbitrumMsgService.getMessageFees(messageData);
            const optimismFees = await optimismMsgService.getMessageFees(messageData);

            // Each chain should have different fees
            expect(polygonFees.totalFee).to.not.equal(arbitrumFees.totalFee);
            expect(arbitrumFees.totalFee).to.not.equal(optimismFees.totalFee);
            expect(optimismFees.totalFee).to.not.equal(polygonFees.totalFee);
        });

        it("Should reject cross-chain messages with insufficient fees", async function () {
            const messageData = await createMessageData(
                ethers.parseEther("1"),
                sender.address,
                receiver.address,
                handlerAddress
            );

            const { totalFee } = await polygonMsgService.getMessageFees(messageData);

            // Create submission with insufficient fee
            const submission = {
                messageType: ethers.solidityPackedKeccak256(["string"], ["pacs.008"]),
                target: handlerAddress,
                targetChain: CROSS_CHAIN_CONSTANTS.POLYGON_CHAIN_ID,
                payload: await polygonMsgService.createPACS008Payload(messageData)
            };

            await expect(
                contracts.protocolCoordinator.connect(sender).submitMessage(
                    submission,
                    { value: totalFee / 2n }
                )
            ).to.be.revertedWith("Insufficient fee");
        });
    });

    describe("Cross-Chain Message Cancellation", () => {
        it("Should allow sender to cancel pending cross-chain message", async function () {
            const messageData = await createMessageData(
                ethers.parseEther("1"),
                sender.address,
                receiver.address,
                handlerAddress
            );

            const { messageId } = await submitAndVerifyMessage(messageData, sender, polygonMsgService);

            await contracts.protocolCoordinator.connect(sender).cancelMessage(messageId);
            
            const status = await contracts.messageRegistry.getMessageStatus(messageId);
            expect(status).to.equal(5); // CANCELLED
        });

        it("Should prevent non-sender from cancelling message", async function () {
            const messageData = await createMessageData(
                ethers.parseEther("1"),
                sender.address,
                receiver.address,
                handlerAddress
            );

            const { messageId } = await submitAndVerifyMessage(messageData, sender, polygonMsgService);

            await expect(
                contracts.protocolCoordinator.connect(receiver).cancelMessage(messageId)
            ).to.be.revertedWith("Not message sender");
        });

        it("Should allow emergency admin to cancel any cross-chain message", async function () {
            const messageData = await createMessageData(
                ethers.parseEther("1"),
                sender.address,
                receiver.address,
                handlerAddress
            );

            const { messageId } = await submitAndVerifyMessage(messageData, sender, polygonMsgService);

            await contracts.protocolCoordinator
                .connect(emergencyAdmin)
                .emergencyCancelMessage(messageId);
            
            const status = await contracts.messageRegistry.getMessageStatus(messageId);
            expect(status).to.equal(5); // CANCELLED
        });
    });

    describe("Cross-Chain State Transitions", () => {
        it("Should emit correct events for cross-chain message submission", async function () {
            const messageData = await createMessageData(
                ethers.parseEther("1"),
                sender.address,
                receiver.address,
                handlerAddress
            );

            const { response } = await submitAndVerifyMessage(messageData, sender, polygonMsgService);
            await verifyStateTransitions(response);
        });
    });
}); */