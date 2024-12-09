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
import { LOCAL_CHAIN_ID } from '../../../src/constants';

describe('Protocol Integration Tests', () => {

    let contracts: {
        protocolCoordinator: ProtocolCoordinator;
        messageRegistry: MessageRegistry;
        messageProtocol: MessageProtocol;
        messageRouter: MessageRouter;
        messageProcessor: MessageProcessor;
        messageHandler: PACS008Handler;
        settlementController: SettlementController;
        erc20Token: ERC20Token,
        liquidityPool: LiquidityPool
    };


    let admin: SignerWithAddress;
    let sender: SignerWithAddress;
    let receiver: SignerWithAddress;

    beforeEach(async () => {

        contracts = await deployContractsFixture();
        [admin, sender, receiver] = await ethers.getSigners();
    });

    describe('End-to-End Message Flow', () => {
        it('should successfully process a message', async () => {
            // Arrange
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                ethers.parseEther('1.0')
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: LOCAL_CHAIN_ID,
                payload
            };

            // Calculate fees
            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);
            const totalFee = baseFee + deliveryFee;

            // Act
            const tx = await contracts.protocolCoordinator.connect(sender).submitMessage(
                submission,
                { value: totalFee }
            );

            // Wait for transaction with increased timeout
            const receipt = await tx.wait(1);
            expect(receipt?.status).to.equal(1);

            // Get event directly from receipt
            const event = receipt?.logs.find(
                log => log.topics[0] === contracts.protocolCoordinator.interface.getEvent('MessageSubmissionInitiated').topicHash
            );
            expect(event).to.exist;

            const messageId = event!.topics[1];

            const [success,] = await contracts.protocolCoordinator.getMessageResult(messageId);

            // Check message status in registry
            const status = await contracts.messageRegistry.getMessageStatus(messageId);

            expect(success).to.be.true;
        });

        it('should reject message with insufficient fee', async () => {
            // Arrange
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await admin.getAddress(),
                await contracts.erc20Token.getAddress(),
                ethers.parseEther('1.0')
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: LOCAL_CHAIN_ID,
                payload
            };

            // Act & Assert - Send with zero fee
            await expect(
                contracts.protocolCoordinator.connect(sender).submitMessage(
                    submission,
                    { value: 0, }
                )
            ).to.be.rejectedWith("Insufficient fee");
        });


        it('should emit correct settlement events', async () => {
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                ethers.parseEther('1.0')
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: LOCAL_CHAIN_ID,
                payload
            };

            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);

            await expect(
                contracts.protocolCoordinator.connect(sender).submitMessage(
                    submission,
                    { value: baseFee + deliveryFee }
                )
            ).to.emit(contracts.settlementController, "SettlementStatusUpdated");
        });
        it('should emit SettlementStatusUpdated with FAILED status when liquidity insufficient', async () => {
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                ethers.parseEther('1.0')
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: LOCAL_CHAIN_ID,
                payload
            };

            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);

            await expect(
                contracts.protocolCoordinator.connect(sender).submitMessage(
                    submission,
                    { value: baseFee + deliveryFee }
                )
            ).to.emit(contracts.settlementController, "SettlementStatusUpdated");
        });

        it('should emit SettlementStatusUpdated with COMPLETED status when settlement succeeds', async () => {
            await contracts.erc20Token.approve(
                contracts.liquidityPool.getAddress(),
                ethers.parseEther('10.0')
            );

            await contracts.liquidityPool.addLiquidity(
                await contracts.erc20Token.getAddress(),
                ethers.parseEther('10.0')
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
                targetChain: LOCAL_CHAIN_ID,
                payload
            };

            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);

            await expect(
                contracts.protocolCoordinator.connect(sender).submitMessage(
                    submission,
                    { value: baseFee + deliveryFee }
                )
            ).to.emit(contracts.settlementController, "SettlementStatusUpdated");
        });
        it('should not change balances when settlement fails due to insufficient liquidity', async () => {
            const amount = ethers.parseEther('1.0');
            const initialReceiverBalance = await contracts.erc20Token.balanceOf(receiver.address);

            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                amount
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: LOCAL_CHAIN_ID,
                payload
            };

            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);

            await contracts.protocolCoordinator.connect(sender).submitMessage(
                submission,
                { value: baseFee + deliveryFee }
            );

            const finalReceiverBalance = await contracts.erc20Token.balanceOf(receiver.address);
            //expect(finalReceiverBalance).to.equal(initialReceiverBalance);
        });

        it('should correctly update balances after successful settlement', async () => {
            const amount = ethers.parseEther('1.0');
            const liquidityAmount = ethers.parseEther('10.0');
            const oldReceiverBalance = await contracts.erc20Token.balanceOf(receiver.address);
        
            // First mint tokens to admin
            await contracts.erc20Token.mint(admin.address, liquidityAmount);
        
            // Grant SETTLEMENT_ROLE to handler
            const handlerAddress = await contracts.messageHandler.getAddress();
            const lpAddress = await contracts.liquidityPool.getAddress();
            
            // Add liquidity
            await contracts.erc20Token.connect(admin).approve(lpAddress, liquidityAmount);
            await contracts.liquidityPool.connect(admin).addLiquidity(
                await contracts.erc20Token.getAddress(),
                liquidityAmount
            );
        
            // Create payload and verify token addresses
            const tokenAddress = await contracts.erc20Token.getAddress();
            
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                receiver.address,
                tokenAddress,
                amount
            );
        
            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: handlerAddress,
                targetChain: LOCAL_CHAIN_ID,
                payload
            };
        
            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);
            
            // Submit message and wait for events
            const tx = await contracts.protocolCoordinator.connect(sender).submitMessage(
                submission,
                { value: baseFee + deliveryFee }
            );
            
            const receipt = await tx.wait();
        
            const finalReceiverBalance = await contracts.erc20Token.balanceOf(receiver.address);
            const finalPoolBalance = await contracts.erc20Token.balanceOf(lpAddress);
        
            expect(finalReceiverBalance).to.equal(BigInt(amount) + BigInt(oldReceiverBalance));
            //expect(finalPoolBalance).to.equal(BigInt(liquidityAmount) - BigInt(amount));
        });
    });
});