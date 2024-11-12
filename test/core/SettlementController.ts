import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { SettlementController, MockToken, MockLiquidityPool } from "../../typechain";

describe("SettlementController", function () {
    let settlementController: SettlementController;
    let mockToken: MockToken;
    let mockTargetToken: MockToken;
    let mockLiquidityPool: MockLiquidityPool;

    // Constants for testing
    const testAmount = ethers.parseEther("1000");
    const testMessageId = ethers.id("TEST_MESSAGE");
    const sourceChain = 1;  // e.g., Ethereum
    const targetChain = 6;  // e.g., Avalanche
    const GAS_LIMIT = 250_000;

    beforeEach(async function () {
        await deployments.fixture(['SettlementController']);

        const { admin, settler, bridge } = await getNamedAccounts();

        // Deploy mock contracts
        const TokenFactory = await ethers.getContractFactory("MockToken");
        mockToken = await TokenFactory.deploy("Mock Token", "MTK");
        mockTargetToken = await TokenFactory.deploy("Target Token", "TTK");

        const LiquidityPoolFactory = await ethers.getContractFactory("MockLiquidityPool");
        mockLiquidityPool = await LiquidityPoolFactory.deploy();

        // Deploy SettlementController with mock dependencies
        const SettlementControllerFactory = await ethers.getContractFactory("SettlementController");
        const wormholeRelayer = await (await ethers.getContractFactory("MockWormholeRelayer")).deploy();
        const tokenBridge = await (await ethers.getContractFactory("MockTokenBridge")).deploy();
        const wormhole = await (await ethers.getContractFactory("MockWormhole")).deploy();

        settlementController = await SettlementControllerFactory.deploy(
            wormholeRelayer.getAddress(),
            tokenBridge.getAddress(),
            wormhole.getAddress(),
            mockLiquidityPool.getAddress()
        );

        // Grant roles
        const settlementRole = await settlementController.SETTLEMENT_ROLE();
        const bridgeRole = await settlementController.BRIDGE_ROLE();

        await settlementController.connect(await ethers.getSigner(admin))
            .grantRole(settlementRole, settler);
        await settlementController.connect(await ethers.getSigner(admin))
            .grantRole(bridgeRole, bridge);

        // Setup supported token
        await settlementController.connect(await ethers.getSigner(admin))
            .updateSupportedToken(await mockToken.getAddress(), targetChain, true);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await settlementController.hasRole(await settlementController.DEFAULT_ADMIN_ROLE(), admin))
                .to.be.true;
        });

        it("Should set initial roles correctly", async function () {
            const { settler, bridge } = await getNamedAccounts();
            expect(await settlementController.hasRole(await settlementController.SETTLEMENT_ROLE(), settler))
                .to.be.true;
            expect(await settlementController.hasRole(await settlementController.BRIDGE_ROLE(), bridge))
                .to.be.true;
        });

        it("Should set correct liquidity pool", async function () {
            expect(await settlementController.liquidityPool()).to.equal(await mockLiquidityPool.getAddress());
        });
    });

    describe("Fee Management", function () {
        it("Should calculate correct settlement fee", async function () {
            const fee = await settlementController.quoteSettlementFee(targetChain, testAmount);
            expect(fee).to.be.gt(0);
        });

        it("Should require sufficient fee for settlement", async function () {
            const { settler } = await getNamedAccounts();
            const fee = await settlementController.quoteSettlementFee(targetChain, testAmount);

            await expect(settlementController.connect(await ethers.getSigner(settler))
                .initiateSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    await mockTargetToken.getAddress(),
                    testAmount,
                    targetChain,
                    settler,
                    { value: fee.sub(1) }
                )).to.be.revertedWith("SettlementController: Insufficient fee");
        });
    });

    describe("Settlement Operations", function () {
        it("Should initiate settlement successfully", async function () {
            const { settler } = await getNamedAccounts();
            const fee = await settlementController.quoteSettlementFee(targetChain, testAmount);

            await expect(settlementController.connect(await ethers.getSigner(settler))
                .initiateSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    await mockTargetToken.getAddress(),
                    testAmount,
                    targetChain,
                    settler,
                    { value: fee }
                ))
                .to.emit(settlementController, "SettlementCreated")
                .withArgs(
                    expect.any(String), // settlementId
                    testMessageId,
                    testAmount
                );
        });

        it("Should store correct settlement details", async function () {
            const { settler } = await getNamedAccounts();
            const fee = await settlementController.quoteSettlementFee(targetChain, testAmount);

            const tx = await settlementController.connect(await ethers.getSigner(settler))
                .initiateSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    await mockTargetToken.getAddress(),
                    testAmount,
                    targetChain,
                    settler,
                    { value: fee }
                );
            const receipt = await tx.wait();
            const event = receipt?.logs.find(x => x.eventSignature === "SettlementCreated(bytes32,bytes32,uint256)");
            const settlementId = event?.args?.[0];

            const settlement = await settlementController.getSettlement(settlementId);
            expect(settlement.messageId).to.equal(testMessageId);
            expect(settlement.sourceToken).to.equal(await mockToken.getAddress());
            expect(settlement.targetToken).to.equal(await mockTargetToken.getAddress());
            expect(settlement.amount).to.equal(testAmount);
            expect(settlement.status).to.equal(1); // IN_PROGRESS
        });

        it("Should process incoming settlement", async function () {
            const { settler, bridge } = await getNamedAccounts();
            const fee = await settlementController.quoteSettlementFee(targetChain, testAmount);

            // Initiate settlement
            const tx = await settlementController.connect(await ethers.getSigner(settler))
                .initiateSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    await mockTargetToken.getAddress(),
                    testAmount,
                    targetChain,
                    settler,
                    { value: fee }
                );
            const receipt = await tx.wait();
            const event = receipt?.logs.find(x => x.eventSignature === "SettlementCreated(bytes32,bytes32,uint256)");
            const settlementId = event?.args?.[0];

            // Process incoming settlement
            const settlementData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "address", "address"],
                [settlementId, settler, await mockTargetToken.getAddress()]
            );

            await expect(settlementController.connect(await ethers.getSigner(bridge))
                .processIncomingSettlement(settlementData, sourceChain))
                .to.emit(settlementController, "SettlementStatusUpdated")
                .withArgs(settlementId, 2); // COMPLETED
        });

        it("Should allow settlement cancellation", async function () {
            const { settler } = await getNamedAccounts();
            const fee = await settlementController.quoteSettlementFee(targetChain, testAmount);

            const tx = await settlementController.connect(await ethers.getSigner(settler))
                .initiateSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    await mockTargetToken.getAddress(),
                    testAmount,
                    targetChain,
                    settler,
                    { value: fee }
                );
            const receipt = await tx.wait();
            const event = receipt?.logs.find(x => x.eventSignature === "SettlementCreated(bytes32,bytes32,uint256)");
            const settlementId = event?.args?.[0];

            await expect(settlementController.connect(await ethers.getSigner(settler))
                .cancelSettlement(settlementId))
                .to.emit(settlementController, "SettlementStatusUpdated")
                .withArgs(settlementId, 4); // CANCELLED
        });
    });

    describe("Query Functions", function () {
        let settlementId: string;

        beforeEach(async function () {
            const { settler } = await getNamedAccounts();
            const fee = await settlementController.quoteSettlementFee(targetChain, testAmount);

            const tx = await settlementController.connect(await ethers.getSigner(settler))
                .initiateSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    await mockTargetToken.getAddress(),
                    testAmount,
                    targetChain,
                    settler,
                    { value: fee }
                );
            const receipt = await tx.wait();
            const event = receipt?.logs.find(x => x.eventSignature === "SettlementCreated(bytes32,bytes32,uint256)");
            settlementId = event?.args?.[0];
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
        it("Should only allow admin to update supported tokens", async function () {
            const { settler } = await getNamedAccounts();
            await expect(settlementController.connect(await ethers.getSigner(settler))
                .updateSupportedToken(await mockToken.getAddress(), targetChain, true))
                .to.be.revertedWith("SettlementController: Must have admin role");
        });

        it("Should only allow settler to initiate settlement", async function () {
            const { bridge } = await getNamedAccounts();
            const fee = await settlementController.quoteSettlementFee(targetChain, testAmount);

            await expect(settlementController.connect(await ethers.getSigner(bridge))
                .initiateSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    await mockTargetToken.getAddress(),
                    testAmount,
                    targetChain,
                    bridge,
                    { value: fee }
                )).to.be.revertedWith("SettlementController: Must have settlement role");
        });

        it("Should only allow bridge to process settlements", async function () {
            const { settler } = await getNamedAccounts();
            const settlementData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "address", "address"],
                [ethers.ZeroHash, settler, await mockTargetToken.getAddress()]
            );

            await expect(settlementController.connect(await ethers.getSigner(settler))
                .processIncomingSettlement(settlementData, sourceChain))
                .to.be.revertedWith("SettlementController: Must have bridge role");
        });
    });

    describe("Emergency Controls", function () {
        it("Should allow admin to pause", async function () {
            const { admin } = await getNamedAccounts();
            await settlementController.connect(await ethers.getSigner(admin)).pause();
            expect(await settlementController.paused()).to.be.true;
        });

        it("Should prevent operations when paused", async function () {
            const { admin, settler } = await getNamedAccounts();
            const fee = await settlementController.quoteSettlementFee(targetChain, testAmount);

            await settlementController.connect(await ethers.getSigner(admin)).pause();
            
            await expect(settlementController.connect(await ethers.getSigner(settler))
                .initiateSettlement(
                    testMessageId,
                    await mockToken.getAddress(),
                    await mockTargetToken.getAddress(),
                    testAmount,
                    targetChain,
                    settler,
                    { value: fee }
                )).to.be.reverted;
        });

        it("Should allow admin to unpause", async function () {
            const { admin } = await getNamedAccounts();
            await settlementController.connect(await ethers.getSigner(admin)).pause();
            await settlementController.connect(await ethers.getSigner(admin)).unpause();
            expect(await settlementController.paused()).to.be.false;
        });
    });
});