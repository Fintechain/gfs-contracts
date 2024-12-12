import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployContractsFixture } from './fixtures';
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
import { generatePACS008Payload } from '../../../src/utils/payload-generator';
import { MESSAGE_TYPE_PACS008 } from '../../../src/types';
import { LOCAL_CHAIN_ID } from '../../../src/constants';

describe('Protocol Management Tests', () => {
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
    let newComponent: SignerWithAddress;

    beforeEach(async () => {
        contracts = await deployContractsFixture();
        [admin, sender, receiver, newComponent] = await ethers.getSigners();
    });

    describe('Component Management', () => {
        it('should update registry component correctly', async () => {
            const registryComponent = ethers.keccak256(ethers.toUtf8Bytes("REGISTRY"));
            const tx = await contracts.protocolCoordinator.connect(admin)
                .updateProtocolComponent(registryComponent, newComponent.address);

            const receipt = await tx.wait();

            // Verify component update
            const config = await contracts.protocolCoordinator.getProtocolConfig();
            const [, , registry] = ethers.AbiCoder.defaultAbiCoder().decode(
                ['uint256', 'uint256', 'address', 'address', 'address', 'address'],
                config
            );

            expect(registry).to.equal(newComponent.address);

            // Verify event emission
            await expect(tx).to.emit(contracts.protocolCoordinator, 'ComponentUpdated')
                .withArgs(registryComponent, newComponent.address);
        });

        it('should prevent non-admin from updating components', async () => {
            const registryComponent = ethers.keccak256(ethers.toUtf8Bytes("REGISTRY"));

            await expect(
                contracts.protocolCoordinator.connect(sender)
                    .updateProtocolComponent(registryComponent, newComponent.address)
            ).to.be.rejectedWith('Caller not admin');
        });

        it('should reject zero address components', async () => {
            const registryComponent = ethers.keccak256(ethers.toUtf8Bytes("REGISTRY"));

            await expect(
                contracts.protocolCoordinator.connect(admin)
                    .updateProtocolComponent(registryComponent, ethers.ZeroAddress)
            ).to.be.rejectedWith('Invalid address');
        });

        it('should reject invalid component types', async () => {
            const invalidComponent = ethers.keccak256(ethers.toUtf8Bytes("INVALID"));

            await expect(
                contracts.protocolCoordinator.connect(admin)
                    .updateProtocolComponent(invalidComponent, newComponent.address)
            ).to.be.rejectedWith('Invalid component');
        });
    });

    describe('Protocol Configuration', () => {
        it('should update base fee correctly', async () => {
            const newFee = ethers.parseEther('0.002');

            const tx = await contracts.protocolCoordinator.connect(admin)
                .updateBaseFee(newFee);

            // Verify fee update
            const updatedFee = await contracts.protocolCoordinator.baseFee();
            expect(updatedFee).to.equal(newFee);

            // Verify event emission
            await expect(tx).to.emit(contracts.protocolCoordinator, 'FeeUpdated')
                .withArgs(newFee);
        });

        it('should prevent non-admin from updating base fee', async () => {
            const newFee = ethers.parseEther('0.002');

            await expect(
                contracts.protocolCoordinator.connect(sender).updateBaseFee(newFee)
            ).to.be.rejectedWith('Caller not admin');
        });

        it('should enforce updated fee in message submission', async () => {
            // Update base fee
            const newFee = ethers.parseEther('0.002');
            await contracts.protocolCoordinator.connect(admin).updateBaseFee(newFee);


            // Create payload
            const amount = ethers.parseEther('1.0');

            // Setup basic submission for reuse
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                amount
            );

            // Attempt message submission with old fee
            const submission = {
                messageType: ethers.ZeroHash,
                target: receiver.address,
                targetChain: 1,
                payload
            };

            const oldFee = ethers.parseEther('0.001');
            await expect(
                contracts.protocolCoordinator.connect(sender)
                    .submitMessage(submission, { value: oldFee })
            ).to.be.rejectedWith('Insufficient fee');
        });
    });

    describe('Protocol State Management', () => {
        let submission: any;
        beforeEach(async () => {
            const amount = ethers.parseEther('1.0');


            // Setup basic submission for reuse
            const payload = generatePACS008Payload(
                await sender.getAddress(),
                await receiver.getAddress(),
                await contracts.erc20Token.getAddress(),
                amount
            );

            submission = {
                messageType: MESSAGE_TYPE_PACS008,
                target: await contracts.messageHandler.getAddress(),
                targetChain: LOCAL_CHAIN_ID,
                payload
            };

        });
        it('should pause protocol operations', async () => {
            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);

            await contracts.protocolCoordinator.connect(admin).pause();

            // Verify operations are paused
            await expect(
                contracts.protocolCoordinator.connect(sender)
                    .submitMessage(submission, { value: baseFee + deliveryFee })
            ).to.be.rejected;
        });

        it('should unpause protocol operations', async () => {
            const [baseFee, deliveryFee] = await contracts.protocolCoordinator.quoteMessageFee(submission);
            // First pause
            await contracts.protocolCoordinator.connect(admin).pause();

            // Then unpause
            await contracts.protocolCoordinator.connect(admin).unpause();

            // Should not revert with pause error
            await expect(
                contracts.protocolCoordinator.connect(sender)
                    .submitMessage(submission, { value: baseFee + deliveryFee })
            ).not.to.be.rejected;
        });

        it('should enforce emergency role for pause', async () => {
            await expect(
                contracts.protocolCoordinator.connect(sender).pause()
            ).to.be.rejectedWith('Caller not emergency admin');
        });

        it('should enforce admin role for unpause', async () => {
            // First pause as admin
            await contracts.protocolCoordinator.connect(admin).pause();

            // Attempt unpause as non-admin
            await expect(
                contracts.protocolCoordinator.connect(sender).unpause()
            ).to.be.rejectedWith('Caller not admin');
        });
    });

    describe('Access Control', () => {
        it('should properly assign initial roles', async () => {
            const defaultAdminRole = await contracts.protocolCoordinator.DEFAULT_ADMIN_ROLE();
            const adminRole = await contracts.protocolCoordinator.ADMIN_ROLE();
            const operatorRole = await contracts.protocolCoordinator.OPERATOR_ROLE();
            const emergencyRole = await contracts.protocolCoordinator.EMERGENCY_ROLE();

            expect(await contracts.protocolCoordinator.hasRole(defaultAdminRole, admin.address)).to.be.true;
            expect(await contracts.protocolCoordinator.hasRole(adminRole, admin.address)).to.be.true;
            expect(await contracts.protocolCoordinator.hasRole(operatorRole, admin.address)).to.be.true;
            expect(await contracts.protocolCoordinator.hasRole(emergencyRole, admin.address)).to.be.true;
        });

        it('should enforce role-based access for emergency actions', async () => {
            // Attempt emergency cancel without role
            await expect(
                contracts.protocolCoordinator.connect(sender)
                    .emergencyCancelMessage(ethers.ZeroHash)
            ).to.be.rejectedWith('Caller not emergency admin');
        });

        it('should enforce role-based access for admin actions', async () => {
            const registryComponent = ethers.keccak256(ethers.toUtf8Bytes("REGISTRY"));

            // Attempt component update without role
            await expect(
                contracts.protocolCoordinator.connect(sender)
                    .updateProtocolComponent(registryComponent, newComponent.address)
            ).to.be.rejectedWith('Caller not admin');
        });

        it('should allow admin to grant roles', async () => {
            const operatorRole = await contracts.protocolCoordinator.OPERATOR_ROLE();

            // Grant operator role to sender
            await contracts.protocolCoordinator.connect(admin)
                .grantRole(operatorRole, sender.address);

            // Verify role assignment
            expect(await contracts.protocolCoordinator.hasRole(operatorRole, sender.address)).to.be.true;
        });
    });
});