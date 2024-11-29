import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";
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
    verifyMessageProcessed,
    verifyStateTransitions
} from "../../helpers/pacs008.helper";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Test suite for PACS008 local message processing
 * @dev Tests the complete flow of local message submission and processing
 */
describe("PACS008 Local Message Processing", function () {
    // Contract instances used across tests
    let contracts: {
        protocolCoordinator: ProtocolCoordinator;
        messageRegistry: MessageRegistry;
        messageProtocol: MessageProtocol;
        messageRouter: MessageRouter;
        messageProcessor: MessageProcessor;
        messageHandler: PACS008Handler;
        settlementController: SettlementController;
    };

    // Test accounts
    let admin: SignerWithAddress;
    let sender1: SignerWithAddress;
    let sender2: SignerWithAddress;
    let receiver: SignerWithAddress;
    
    // Service configuration
    let handlerAddress: string;
    let msgService: PACS008MessageServiceImpl;

    /**
     * Test setup before each test case
     * Deploys contracts and initializes test accounts
     */
    beforeEach(async function () {
        // Deploy fresh contracts for each test
        contracts = await deployContractsFixture();

        // Setup test accounts
        const signers = await ethers.getSigners();
        [admin, sender1, sender2, receiver] = signers;

        // Initialize message service
        handlerAddress = await contracts.messageHandler.getAddress();
        msgService = new PACS008MessageServiceImpl(
            contracts.protocolCoordinator,
            TEST_CONSTANTS.LOCAL_CHAIN_ID
        );
    });

    /**
     * Tests minimum amount message processing
     * @test
     */
    it("Should successfully submit and process a PACS008 message with minimum amount", async function () {
        // Create and submit message with minimum allowed amount
        const messageData = await createMessageData(
            TEST_CONSTANTS.MINIMUM_AMOUNT,
            sender1.address,
            receiver.address,
            handlerAddress
        );

        const { messageId } = await submitAndVerifyMessage(messageData, admin, msgService);
        
        // Verify message processing
        await verifyMessageProcessed(contracts.messageRegistry, messageId);

        // Verify chain ID is correct
        const message = await contracts.messageRegistry.getMessage(messageId);
        expect(Number(message.targetChain)).to.equal(TEST_CONSTANTS.LOCAL_CHAIN_ID);
    });

    /**
     * Tests maximum amount message processing
     * @test
     */
    it("Should successfully submit and process a PACS008 message with maximum amount", async function () {
        const messageData = await createMessageData(
            TEST_CONSTANTS.MAXIMUM_AMOUNT,
            sender1.address,
            receiver.address,
            handlerAddress
        );

        const { messageId } = await submitAndVerifyMessage(messageData, admin, msgService);
        await verifyMessageProcessed(contracts.messageRegistry, messageId);
    });

    /**
     * Tests sequential message processing from single sender
     * @test
     */
    it("Should handle multiple messages in sequence from the same sender", async function () {
        // Test with three different amounts
        const amounts = [
            ethers.parseEther("1"),
            ethers.parseEther("2"),
            ethers.parseEther("3")
        ];

        // Submit messages sequentially
        const messageResults = await Promise.all(
            amounts.map(async (amount) => {
                const messageData = await createMessageData(
                    amount,
                    sender1.address,
                    receiver.address,
                    handlerAddress
                );
                return submitAndVerifyMessage(messageData, admin, msgService);
            })
        );

        // Verify all messages were processed successfully
        for (const { messageId } of messageResults) {
            await verifyMessageProcessed(contracts.messageRegistry, messageId);
        }
    });

    /**
     * Tests message processing from different senders
     * @test
     */
    it("Should process messages from different senders correctly", async function () {
        // Create messages from different senders
        const messageData1 = await createMessageData(
            ethers.parseEther("1"),
            sender1.address,
            receiver.address,
            handlerAddress
        );

        const messageData2 = await createMessageData(
            ethers.parseEther("2"),
            sender2.address,
            receiver.address,
            handlerAddress
        );

        // Submit and process both messages
        const result1 = await submitAndVerifyMessage(messageData1, admin, msgService);
        const result2 = await submitAndVerifyMessage(messageData2, admin, msgService);

        // Verify both messages processed successfully
        await verifyMessageProcessed(contracts.messageRegistry, result1.messageId);
        await verifyMessageProcessed(contracts.messageRegistry, result2.messageId);
    });

    /**
     * Tests message state transitions
     * @test
     */
    it("Should maintain correct message state transitions", async function () {
        const messageData = await createMessageData(
            ethers.parseEther("1"),
            sender1.address,
            receiver.address,
            handlerAddress
        );

        // Submit message and verify state transitions
        const { messageId, response } = await submitAndVerifyMessage(messageData, admin, msgService);
        await verifyStateTransitions(response);
        await verifyMessageProcessed(contracts.messageRegistry, messageId);
    });
});