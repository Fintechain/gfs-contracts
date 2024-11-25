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
import { PACS008MessageServiceImpl } from "../../../src/utils/message.service";

describe("End-to-End Local Message Processing Debug", function () {
    let contracts: {
        protocolCoordinator: ProtocolCoordinator;
        messageRegistry: MessageRegistry;
        messageProtocol: MessageProtocol;
        messageRouter: MessageRouter;
        messageProcessor: MessageProcessor;
        messageHandler: PACS008Handler;
        settlementController: SettlementController;
    };

    beforeEach(async function () {
        contracts = await deployContractsFixture();
        // Verify all contracts are available
        Object.entries(contracts).forEach(([name, contract]) => {
            if (!contract) {
                throw new Error(`Contract ${name} is undefined after fixture loading`);
            }
        });
    });

    it("Should process PACS008 message through local routing using chain ID 0", async function () {
        const { admin, user, voter1 } = await getNamedAccounts();
        const userSigner = await ethers.getSigner(user);
        const handlerAddress = await contracts.messageHandler.getAddress();
        const msgService = new PACS008MessageServiceImpl(contracts.protocolCoordinator);
        
        const messageData = {
            debtorAddr: voter1,
            creditorAddr: admin,
            tokenAddr: ethers.Wallet.createRandom().address,
            amount: ethers.parseEther("1"),
            instructionId: ethers.hexlify(ethers.randomBytes(32)),
            handlerAddr: handlerAddress
        };
        
        console.log('This is the submission', messageData);
        const receipt = await msgService.submitMessage(messageData, userSigner);

        // Get messageId from event
        const messageSubmittedEvent = receipt?.logs.find(
            log => log.topics[0] === ethers.id("MessageSubmissionInitiated(bytes32,address,bytes32,address,uint16)")
        );
        const messageId = messageSubmittedEvent?.topics[1];
        const message = await contracts.messageRegistry.getMessage(messageId!);


        // Wait for a block to allow processing
        await ethers.provider.send("evm_mine", []);

        const finalStatus = await contracts.messageRegistry.getMessageStatus(messageId!);

        // Assertions
        expect(Number(message.targetChain)).to.equal(0);
        expect(Number(finalStatus)).to.equal(2, "Message should be in PROCESSED state");
    });
});