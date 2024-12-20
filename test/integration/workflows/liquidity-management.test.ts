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

describe('Liquidity Management Tests', () => {
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
    let liquidityProvider: SignerWithAddress;
    let tokenAddress: string;
    let amount: bigint;

    beforeEach(async () => {
        contracts = await deployContractsFixture();
        [admin, sender, receiver, liquidityProvider] = await ethers.getSigners();
        tokenAddress = await contracts.erc20Token.getAddress();
        amount = ethers.parseEther('100.0');
        
        await contracts.liquidityPool.connect(admin).setPermissionlessLiquidity(true)

        // Mint tokens to liquidity provider
        await contracts.erc20Token.mint(liquidityProvider.address, amount * 2n);
    });

    describe('Pool Operations', () => {
        it('should verify existing liquidity pool configuration', async () => {
            const poolInfo = await contracts.liquidityPool.getPoolInfo(tokenAddress);
            
            expect(poolInfo.isActive).to.be.true;
            expect(poolInfo.minLiquidity).to.equal(0); // From deployment script
            expect(poolInfo.maxLiquidity).to.equal(ethers.parseUnits("1000000", 18)); // From deployment script
            expect(poolInfo.totalLiquidity).to.equal(0);
        });

        it('should handle liquidity addition correctly', async () => {
            // Approve tokens
            await contracts.erc20Token.connect(liquidityProvider)
                .approve(await contracts.liquidityPool.getAddress(), amount);

            // Add liquidity
            const tx = await contracts.liquidityPool.connect(liquidityProvider)
                .addLiquidity(tokenAddress, amount);

            // Verify event emission
            await expect(tx).to.emit(contracts.liquidityPool, 'LiquidityAdded')
                .withArgs(tokenAddress, liquidityProvider.address, amount);

            // Verify pool state
            const poolInfo = await contracts.liquidityPool.getPoolInfo(tokenAddress);
            expect(poolInfo.totalLiquidity).to.equal(amount);
            expect(poolInfo.availableLiquidity).to.equal(amount);
        });

        it('should enforce liquidity limits', async () => {
            const excessAmount = ethers.parseUnits("1000001", 18); // Exceeds max from deployment
            await contracts.erc20Token.mint(liquidityProvider.address, excessAmount);
            await contracts.erc20Token.connect(liquidityProvider)
                .approve(await contracts.liquidityPool.getAddress(), excessAmount);

            // Should fail when exceeding max liquidity
            await expect(
                contracts.liquidityPool.connect(liquidityProvider)
                    .addLiquidity(tokenAddress, excessAmount)
            ).to.be.rejectedWith('LiquidityPool: Exceeds max liquidity');
        });
    });

    describe('Settlement Integration', () => {
        beforeEach(async () => {
            // Setup liquidity
            await contracts.erc20Token.connect(liquidityProvider)
                .approve(await contracts.liquidityPool.getAddress(), amount);
            await contracts.liquidityPool.connect(liquidityProvider)
                .addLiquidity(tokenAddress, amount);
        });

        it('should process settlement with sufficient liquidity', async () => {
            const transferAmount = ethers.parseEther('1.0');
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                tokenAddress,
                transferAmount
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: LOCAL_CHAIN_ID,
                payload
            };

            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);
            const initialReceiverBalance = await contracts.erc20Token.balanceOf(receiver.address);

            // Submit message for settlement
            const tx = await contracts.protocolCoordinator.connect(sender)
                .submitMessage(submission, { value: baseFee + deliveryFee });
            
            await tx.wait();

            // Verify settlement outcome
            const finalReceiverBalance = await contracts.erc20Token.balanceOf(receiver.address);
            expect(finalReceiverBalance).to.equal(initialReceiverBalance + transferAmount);
        });

        it('should handle settlement failure when insufficient liquidity', async () => {
            const transferAmount = ethers.parseEther('1000.0'); // More than available
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                tokenAddress,
                transferAmount
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: LOCAL_CHAIN_ID,
                payload
            };

            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);
            const initialReceiverBalance = await contracts.erc20Token.balanceOf(receiver.address);

            // Submit message
            await contracts.protocolCoordinator.connect(sender)
                .submitMessage(submission, { value: baseFee + deliveryFee });

            // Verify balances unchanged
            const finalReceiverBalance = await contracts.erc20Token.balanceOf(receiver.address);
            expect(finalReceiverBalance).to.equal(initialReceiverBalance);
        });

        it('should maintain accurate pool state after settlements', async () => {
            const transferAmount = ethers.parseEther('1.0');
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                tokenAddress,
                transferAmount
            );

            const submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: LOCAL_CHAIN_ID,
                payload
            };

            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);
            const initialPoolInfo = await contracts.liquidityPool.getPoolInfo(tokenAddress);

            // Process settlement
            await contracts.protocolCoordinator.connect(sender)
                .submitMessage(submission, { value: baseFee + deliveryFee });

            // Verify pool state
            const finalPoolInfo = await contracts.liquidityPool.getPoolInfo(tokenAddress);
            expect(finalPoolInfo.totalLiquidity).to.equal(initialPoolInfo.totalLiquidity - transferAmount);
            expect(finalPoolInfo.availableLiquidity).to.equal(initialPoolInfo.availableLiquidity - transferAmount);
        });
    });

    describe('Liquidity Provider Operations', () => {
        beforeEach(async () => {
            await contracts.erc20Token.connect(liquidityProvider)
                .approve(await contracts.liquidityPool.getAddress(), amount);
            await contracts.liquidityPool.connect(liquidityProvider)
                .addLiquidity(tokenAddress, amount);
        });

        /* it('should enforce withdrawal cooldown', async () => {
            // First withdrawal should succeed
            /* await contracts.liquidityPool.connect(liquidityProvider)
                .removeLiquidity(tokenAddress, amount / 2n); 
        
            // Immediate second withdrawal should fail due to cooldown
            await expect(
                contracts.liquidityPool.connect(liquidityProvider)
                    .removeLiquidity(tokenAddress, amount / 2n)
            ).to.be.rejectedWith('LiquidityPool: Withdrawal too soon');
        }); */

        it('should handle liquidity removal correctly after cooldown', async () => {
            // Increase time to pass cooldown
            await ethers.provider.send('evm_increaseTime', [3600]); // 1 hour
            await ethers.provider.send('evm_mine', []);

            const shares = amount;
            const initialBalance = await contracts.erc20Token.balanceOf(liquidityProvider.address);

            const tx = await contracts.liquidityPool.connect(liquidityProvider)
                .removeLiquidity(tokenAddress, shares);

            // Verify event emission
            await expect(tx).to.emit(contracts.liquidityPool, 'LiquidityRemoved')
                .withArgs(tokenAddress, liquidityProvider.address, amount);

            // Verify balance changes
            const finalBalance = await contracts.erc20Token.balanceOf(liquidityProvider.address);
            expect(finalBalance).to.equal(initialBalance + amount);
        });
    });

    
});