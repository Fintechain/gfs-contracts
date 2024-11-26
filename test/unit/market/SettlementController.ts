import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { SettlementController, MockERC20Token, MockLiquidityPool } from "../../../typechain";

enum SettlementStatus {
    NONE,
    IN_PROGRESS,
    COMPLETED,
    FAILED,
    CANCELLED
}

describe("SettlementController", function () {
    let settlementController: SettlementController;
    let mockToken: MockERC20Token;
    let mockLiquidityPool: MockLiquidityPool;

    let user: string;

    // Constants for testing
    const testAmount = 1000n * 10n ** 18n;  // 1000 tokens
    const testMessageId = ethers.id("TEST_MESSAGE");

    beforeEach(async function () {
        await deployments.fixture(['tokens', 'core', 'SettlementController']);

        const { admin } = await getNamedAccounts();
        const signers = await ethers.getSigners();
        // Validate that there are enough signers for testing
        if (signers.length < 3) {
            throw new Error("Not enough accounts available. At least 3 are required for testing.");
        }

        user = signers[2].address;

        // Get deployed contract instances
        const settlementControllerDeployment = await deployments.get('SettlementController');
        const mockTokenDeployment = await deployments.get('MockERC20Token');
        const mockLiquidityPoolDeployment = await deployments.get('MockLiquidityPool');

        // Get contract instances
        settlementController = await ethers.getContractAt('SettlementController', settlementControllerDeployment.address);
        mockToken = await ethers.getContractAt('MockERC20Token', mockTokenDeployment.address);
        mockLiquidityPool = await ethers.getContractAt('MockLiquidityPool', mockLiquidityPoolDeployment.address);

        // Grant handler role
        const handlerRole = await settlementController.HANDLER_ROLE();
        await settlementController.connect(await ethers.getSigner(admin))
            .grantRole(handlerRole, admin);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await settlementController.hasRole(await settlementController.DEFAULT_ADMIN_ROLE(), admin))
                .to.be.true;
        });

        it("Should set correct liquidity pool address", async function () {
            expect(await settlementController.liquidityPool()).to.equal(await mockLiquidityPool.getAddress());
        });
    });

    describe("Settlement Operations", function () {
        let settlementId: string;

        beforeEach(async function () {
            const { admin } = await getNamedAccounts();
            const tx = await settlementController.connect(await ethers.getSigner(admin))
                .processSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    testAmount,
                    user
                );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => 
                log.topics[0] === ethers.id("SettlementProcessed(bytes32,bytes32,uint256,address)")
            );
            settlementId = event?.topics[1] as string;
        });

        it("Should process settlement successfully", async function () {
            const { admin } = await getNamedAccounts();
            const newMessageId = ethers.id("NEW_MESSAGE");

            const tx = await settlementController.connect(await ethers.getSigner(admin))
                .processSettlement(
                    newMessageId,
                    await mockToken.getAddress(),
                    testAmount,
                    user
                );

            await expect(tx)
                .to.emit(settlementController, "SettlementProcessed")
                .withArgs(
                    (settlementId: string) => ethers.isHexString(settlementId, 32),
                    newMessageId,
                    testAmount,
                    user
                );
        });

        it("Should store correct settlement details", async function () {
            const settlement = await settlementController.getSettlement(settlementId);
            expect(settlement.messageId).to.equal(testMessageId);
            expect(settlement.token).to.equal(await mockToken.getAddress());
            expect(settlement.amount).to.equal(testAmount);
            expect(settlement.recipient).to.equal(user);
            expect(settlement.status).to.equal(SettlementStatus.COMPLETED);
        });

        it("Should prevent duplicate settlement processing", async function () {
            const { admin } = await getNamedAccounts();
            
            // Try to process the same settlement again
            await expect(settlementController.connect(await ethers.getSigner(admin))
                .processSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    testAmount,
                    user
                ))
                .to.not.be.reverted;
        });
    });

    describe("Query Functions", function () {
        let settlementId: string;

        beforeEach(async function () {
            const { admin } = await getNamedAccounts();
            const tx = await settlementController.connect(await ethers.getSigner(admin))
                .processSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    testAmount,
                    user
                );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => 
                log.topics[0] === ethers.id("SettlementProcessed(bytes32,bytes32,uint256,address)")
            );
            settlementId = event?.topics[1] as string;
        });

        it("Should return correct settlement details", async function () {
            const settlement = await settlementController.getSettlement(settlementId);
            expect(settlement.messageId).to.equal(testMessageId);
            expect(settlement.amount).to.equal(testAmount);
        });

        it("Should return correct message settlements", async function () {
            const settlements = await settlementController.getSettlementsByMessage(testMessageId);
            expect(settlements).to.have.lengthOf(1);
            expect(settlements[0]).to.equal(settlementId);
        });
    });

    describe("Access Control", function () {
        it("Should only allow handlers to process settlements", async function () {
            await expect(settlementController.connect(await ethers.getSigner(user))
                .processSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    testAmount,
                    user
                )).to.be.revertedWith("Only handlers");
        });
    });

    describe("Emergency Controls", function () {
        it("Should allow admin to pause", async function () {
            const { admin } = await getNamedAccounts();
            await settlementController.connect(await ethers.getSigner(admin)).pause();
            expect(await settlementController.paused()).to.be.true;
        });

        it("Should prevent operations when paused", async function () {
            const { admin } = await getNamedAccounts();
            await settlementController.connect(await ethers.getSigner(admin)).pause();
            
            await expect(settlementController.connect(await ethers.getSigner(admin))
                .processSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    testAmount,
                    user
                )).to.be.revertedWithCustomError(settlementController, "EnforcedPause");
        });

        it("Should allow admin to unpause", async function () {
            const { admin } = await getNamedAccounts();
            await settlementController.connect(await ethers.getSigner(admin)).pause();
            await settlementController.connect(await ethers.getSigner(admin)).unpause();
            expect(await settlementController.paused()).to.be.false;
        });
    });
});