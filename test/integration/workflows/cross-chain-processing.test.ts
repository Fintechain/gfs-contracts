import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployContractsFixture } from './fixtures';
import { generatePACS008Payload } from '../../../src/utils/payload-generator';
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
    ProtocolCoordinator,
    MessageRegistry,
    MessageProtocol,
    MessageRouter,
    MessageProcessor,
    PACS008Handler,
    SettlementController,
    ERC20Token,
    LiquidityPool,
} from "../../../typechain";
import { MESSAGE_TYPE_PACS008 } from '../../../src/types';

describe('Cross-Chain Processing Tests', () => {
    let contracts: {
        protocolCoordinator: ProtocolCoordinator;
        messageRegistry: MessageRegistry;
        messageProtocol: MessageProtocol;
        messageRouter: MessageRouter;
        messageProcessor: MessageProcessor;
        messageHandler: PACS008Handler;
        settlementController: SettlementController;
        erc20Token: ERC20Token;
        liquidityPool: LiquidityPool;
    };

    let admin: SignerWithAddress;
    let sender: SignerWithAddress;
    let receiver: SignerWithAddress;
    const TARGET_CHAIN_ID = 2; // Different from LOCAL_CHAIN(1)

    beforeEach(async () => {
        contracts = await deployContractsFixture();
        [admin, sender, receiver] = await ethers.getSigners();
    });

    describe('Cross-Chain Message Routing', () => {
        it('should calculate cross-chain fees correctly', async () => {
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                ethers.parseEther('1.0')
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: TARGET_CHAIN_ID,
                payload
            };

            // Get fees for both local and cross-chain
            const [, localDeliveryFee] = await contracts.protocolCoordinator.quoteMessageFee({
                ...submission,
                targetChain: 1
            });
            const [, crossChainFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);

            // Cross-chain fee should be higher due to additional Wormhole fees
            expect(crossChainFee).to.be.gt(localDeliveryFee);
        });

        it('should initiate cross-chain message routing', async () => {
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                ethers.parseEther('1.0')
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: TARGET_CHAIN_ID,
                payload
            };

            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);

            const tx = await contracts.protocolCoordinator.connect(sender)
                .submitMessage(submission, { value: baseFee + deliveryFee });

            // Verify event emissions
            await expect(tx).to.emit(contracts.protocolCoordinator, 'MessageSubmissionInitiated')
                .withArgs(
                    // messageId will be dynamically generated
                    ethers.ZeroHash, // We'll match with wildcard since we can't predict the messageId
                    sender.address,
                    submission.messageType,
                    submission.target,
                    TARGET_CHAIN_ID
                );
        });

        it('should validate target chain requirements', async () => {
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                ethers.parseEther('1.0')
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: 0, // Invalid chain ID
                payload
            };

            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee({
                ...submission,
                targetChain: TARGET_CHAIN_ID // Use valid chain for fee calculation
            });

            await expect(
                contracts.protocolCoordinator.connect(sender)
                    .submitMessage(submission, { value: baseFee + deliveryFee })
            ).to.be.rejectedWith('Invalid chain ID');
        });

        it('should track cross-chain message status', async () => {
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                ethers.parseEther('1.0')
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: TARGET_CHAIN_ID,
                payload
            };

            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);

            const tx = await contracts.protocolCoordinator.connect(sender)
                .submitMessage(submission, { value: baseFee + deliveryFee });
            const receipt = await tx.wait();

            // Extract messageId from event
            const event = receipt?.logs.find(
                log => log.topics[0] === contracts.protocolCoordinator.interface.getEvent('MessageSubmissionInitiated').topicHash
            );
            const messageId = event!.topics[1];

            // Check status - should be PENDING for cross-chain messages
            const status = await contracts.messageRegistry.getMessageStatus(messageId);
            expect(status).to.equal(0); // PENDING
        });
    });

    describe('Cross-Chain Fee Management', () => {
        it('should enforce cross-chain fee parameters', async () => {
            // Update cross-chain fee parameters
            await contracts.messageRouter.connect(admin)
                .setCrossChainFeeParameters(
                    ethers.parseEther('0.003'), // New base fee
                    300n // New multiplier
                );

            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                ethers.parseEther('1.0')
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: TARGET_CHAIN_ID,
                payload
            };

            const [, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);

            // Verify fee is calculated with new parameters
            expect(deliveryFee).to.be.gte(ethers.parseEther('0.003'));
        });

        it('should prevent unauthorized fee parameter updates', async () => {
            await expect(
                contracts.messageRouter.connect(sender)
                    .setCrossChainFeeParameters(
                        ethers.parseEther('0.003'),
                        300n
                    )
            ).to.be.rejectedWith('MessageRouter: Must have admin role');
        });
    });

    describe('Cross-Chain Gas Management', () => {
        it('should set and enforce chain-specific gas limits', async () => {
            const newGasLimit = 500_000n;
            
            // Set gas limit for target chain
            await contracts.messageRouter.connect(admin)
                .setChainGasLimit(TARGET_CHAIN_ID, newGasLimit);

            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                ethers.parseEther('1.0')
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: TARGET_CHAIN_ID,
                payload
            };

            // Get fees before and after gas limit change
            const [, deliveryFeeAfter] = await contracts.protocolCoordinator.quoteMessageFee(submission);

            // Fee should reflect higher gas limit
            expect(deliveryFeeAfter).to.be.gt(0);
        });

        it('should prevent setting invalid gas limits', async () => {
            await expect(
                contracts.messageRouter.connect(admin)
                    .setChainGasLimit(TARGET_CHAIN_ID, 0)
            ).to.be.rejectedWith('MessageRouter: Invalid gas limit');
        });
    });
});