import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { LiquidityPool, IERC20, ERC20Mock } from "../../../typechain";

describe("LiquidityPool", function () {
    let liquidityPool: LiquidityPool;
    let mockToken: IERC20;

    let settler: string;
    let provider: string;

    const minLiquidity = ethers.parseEther("100");
    const maxLiquidity = ethers.parseEther("10000");
    const testAmount = ethers.parseEther("1000");
    const testSettlementId = ethers.id("TEST_SETTLEMENT");

    beforeEach(async function () {
        await deployments.fixture(['tokens', 'mocks', 'SettlementController']);

        const { admin } = await getNamedAccounts();

        const signers = await ethers.getSigners();
        // Validate that there are enough signers for testing
        if (signers.length < 3) {
            throw new Error("Not enough accounts available. At least 3 are required for testing.");
        }
        settler = signers[2].address;
        provider = signers[3].address;

        const LiquidityPoolDeployment = await deployments.get('LiquidityPool');
        liquidityPool = await ethers.getContractAt('LiquidityPool', LiquidityPoolDeployment.address);

        // Deploy mock token
        const MockToken = await ethers.getContractFactory("MockERC20Token");
        mockToken = await MockToken.deploy("Mock Token", "MTK");

        // Grant roles
        const providerRole = await liquidityPool.LIQUIDITY_PROVIDER_ROLE();
        const settlementRole = await liquidityPool.SETTLEMENT_ROLE();

        await liquidityPool.connect(await ethers.getSigner(admin)).grantRole(providerRole, provider);
        await liquidityPool.connect(await ethers.getSigner(admin)).grantRole(settlementRole, settler);

        // Create pool
        await liquidityPool.connect(await ethers.getSigner(admin))
            .createPool(await mockToken.getAddress(), minLiquidity, maxLiquidity);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await liquidityPool.hasRole(await liquidityPool.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
        });

        it("Should set initial roles correctly", async function () {
            expect(await liquidityPool.hasRole(await liquidityPool.LIQUIDITY_PROVIDER_ROLE(), provider)).to.be.true;
            expect(await liquidityPool.hasRole(await liquidityPool.SETTLEMENT_ROLE(), settler)).to.be.true;
        });
    });

    describe("Pool Management", function () {
        it("Should allow admin to create pool", async function () {
            const { admin } = await getNamedAccounts();
            const newToken = await (await ethers.getContractFactory("MockERC20Token")).deploy("New Token", "NTK");

            await expect(liquidityPool.connect(await ethers.getSigner(admin))
                .createPool(await newToken.getAddress(), minLiquidity, maxLiquidity))
                .to.emit(liquidityPool, "PoolCreated")
                .withArgs(await newToken.getAddress(), minLiquidity, maxLiquidity);
        });

        it("Should store correct pool info", async function () {
            const poolInfo = await liquidityPool.getPoolInfo(await mockToken.getAddress());
            expect(poolInfo.minLiquidity).to.equal(minLiquidity);
            expect(poolInfo.maxLiquidity).to.equal(maxLiquidity);
            expect(poolInfo.isActive).to.be.true;
        });

        it("Should revert if non-admin tries to create pool", async function () {
            const newToken = await (await ethers.getContractFactory("MockERC20Token")).deploy("New Token", "NTK");

            await expect(liquidityPool.connect(await ethers.getSigner(settler))
                .createPool(await newToken.getAddress(), minLiquidity, maxLiquidity))
                .to.be.rejectedWith("LiquidityPool: Must have admin role");
        });
    });


    describe("Liquidity Operations", function () {
        beforeEach(async function () {

            // Mint tokens to provider
            await (mockToken as ERC20Mock).mint(provider, testAmount);
            // Approve pool
            await mockToken.connect(await ethers.getSigner(provider))
                .approve(liquidityPool.getAddress(), testAmount);
        });

        it("Should allow provider to add liquidity", async function () {

            await expect(liquidityPool.connect(await ethers.getSigner(provider))
                .addLiquidity(await mockToken.getAddress(), testAmount))
                .to.emit(liquidityPool, "LiquidityAdded")
                .withArgs(await mockToken.getAddress(), provider, testAmount);
        });

        it("Should correctly calculate shares", async function () {

            const tx = await liquidityPool.connect(await ethers.getSigner(provider))
                .addLiquidity(await mockToken.getAddress(), testAmount);
            const receipt = await tx.wait();

            // First liquidity provider should get equal shares to amount
            const pool = await liquidityPool.getPoolInfo(await mockToken.getAddress());
            expect(pool.totalLiquidity).to.equal(testAmount);
        });

        it("Should allow liquidity removal", async function () {

            // Add liquidity first
            await liquidityPool.connect(await ethers.getSigner(provider))
                .addLiquidity(await mockToken.getAddress(), testAmount);

            // Remove half
            const removeAmount = testAmount / 2n;
            await expect(liquidityPool.connect(await ethers.getSigner(provider))
                .removeLiquidity(await mockToken.getAddress(), removeAmount))
                .to.emit(liquidityPool, "LiquidityRemoved")
            //.withArgs(await mockToken.getAddress(), provider, removeAmount);
        });

        it("Should revert if removing more than available", async function () {

            await liquidityPool.connect(await ethers.getSigner(provider))
                .addLiquidity(await mockToken.getAddress(), testAmount);

            await expect(liquidityPool.connect(await ethers.getSigner(provider))
                .removeLiquidity(await mockToken.getAddress(), testAmount * 2n))
                .to.be.rejectedWith("LiquidityPool: Insufficient shares");
        });
    });

    describe("Settlement Operations", function () {
        beforeEach(async function () {

            // Add initial liquidity
            await (mockToken as ERC20Mock).mint(provider, testAmount);
            await mockToken.connect(await ethers.getSigner(provider))
                .approve(liquidityPool.getAddress(), testAmount);
            await liquidityPool.connect(await ethers.getSigner(provider))
                .addLiquidity(await mockToken.getAddress(), testAmount);
        });

        it("Should allow settler to lock liquidity", async function () {
            const lockAmount = testAmount / 2n;

            await expect(liquidityPool.connect(await ethers.getSigner(settler))
                .lockLiquidity(await mockToken.getAddress(), lockAmount, testSettlementId))
                .to.emit(liquidityPool, "LiquidityLocked")
                .withArgs(await mockToken.getAddress(), testSettlementId, lockAmount);
        });

        it("Should update available liquidity after lock", async function () {
            const lockAmount = testAmount / 2n;

            await liquidityPool.connect(await ethers.getSigner(settler))
                .lockLiquidity(await mockToken.getAddress(), lockAmount, testSettlementId);

            const pool = await liquidityPool.getPoolInfo(await mockToken.getAddress());
            expect(pool.availableLiquidity).to.equal(testAmount - lockAmount);
            expect(pool.lockedLiquidity).to.equal(lockAmount);
        });

        /* it("Should allow settler to release liquidity", async function () {
            const { settler } = await getNamedAccounts();
            const lockAmount = testAmount / 2n;

            await liquidityPool.connect(await ethers.getSigner(settler))
                .lockLiquidity(await mockToken.getAddress(), lockAmount, testSettlementId);

            await expect(liquidityPool.connect(await ethers.getSigner(settler))
                .releaseLiquidity(await mockToken.getAddress(), lockAmount, testSettlementId))
                .to.emit(liquidityPool, "LiquidityReleased")
                .withArgs(await mockToken.getAddress(), testSettlementId, lockAmount);
        }); */

        it("Should correctly check available liquidity", async function () {
            const lockAmount = testAmount / 2n;

            await liquidityPool.connect(await ethers.getSigner(settler))
                .lockLiquidity(await mockToken.getAddress(), lockAmount, testSettlementId);

            // Should have enough for another lock of same size
            expect(await liquidityPool.hasAvailableLiquidity(
                await mockToken.getAddress(),
                lockAmount
            )).to.be.true;

            // Should not have enough for full amount
            expect(await liquidityPool.hasAvailableLiquidity(
                await mockToken.getAddress(),
                testAmount
            )).to.be.false;
        });
    });

    describe("Emergency Controls", function () {
        it("Should allow admin to pause", async function () {
            const { admin } = await getNamedAccounts();
            await liquidityPool.connect(await ethers.getSigner(admin)).pause();
            expect(await liquidityPool.paused()).to.be.true;
        });

        it("Should prevent operations when paused", async function () {
            const { admin } = await getNamedAccounts();
            await liquidityPool.connect(await ethers.getSigner(admin)).pause();

            await expect(liquidityPool.connect(await ethers.getSigner(provider))
                .addLiquidity(await mockToken.getAddress(), testAmount))
                .to.be.rejected;
        });

        it("Should allow admin to unpause", async function () {
            const { admin } = await getNamedAccounts();
            await liquidityPool.connect(await ethers.getSigner(admin)).pause();
            await liquidityPool.connect(await ethers.getSigner(admin)).unpause();
            expect(await liquidityPool.paused()).to.be.false;
        });
    });

    describe("Permissionless Liquidity Controls", function () {
        let nonProvider: string;

        beforeEach(async function () {
            const signers = await ethers.getSigners();
            nonProvider = signers[4].address; // Account without provider role

            // Mint tokens to non-provider for testing
            await (mockToken as ERC20Mock).mint(nonProvider, testAmount);
            await mockToken.connect(await ethers.getSigner(nonProvider))
                .approve(liquidityPool.getAddress(), testAmount);
        });

        describe("Permissionless Mode", function () {
            it("Should only allow admin to set permissionless mode", async function () {
                const { admin } = await getNamedAccounts();

                // Non-admin attempt should fail
                await expect(liquidityPool.connect(await ethers.getSigner(provider))
                    .setPermissionlessLiquidity(true))
                    .to.be.rejectedWith("LiquidityPool: Must have admin role");

                // Admin should succeed
                await expect(liquidityPool.connect(await ethers.getSigner(admin))
                    .setPermissionlessLiquidity(true))
                    .to.emit(liquidityPool, "PermissionlessLiquiditySet")
                    .withArgs(true);
            });

            it("Should allow non-providers to add liquidity when permissionless", async function () {
                const { admin } = await getNamedAccounts();

                // Enable permissionless mode
                await liquidityPool.connect(await ethers.getSigner(admin))
                    .setPermissionlessLiquidity(true);

                // Non-provider should be able to add liquidity
                await expect(liquidityPool.connect(await ethers.getSigner(nonProvider))
                    .addLiquidity(await mockToken.getAddress(), testAmount))
                    .to.emit(liquidityPool, "LiquidityAdded")
                    .withArgs(await mockToken.getAddress(), nonProvider, testAmount);
            });

            it("Should prevent non-providers from adding liquidity when not permissionless", async function () {
                // Without enabling permissionless mode
                await expect(liquidityPool.connect(await ethers.getSigner(nonProvider))
                    .addLiquidity(await mockToken.getAddress(), testAmount))
                    .to.be.rejectedWith("LiquidityPool: Must have provider role");
            });

            it("Should maintain provider role access when permissionless", async function () {
                const { admin } = await getNamedAccounts();

                // Enable permissionless mode
                await liquidityPool.connect(await ethers.getSigner(admin))
                    .setPermissionlessLiquidity(true);

                await (mockToken as ERC20Mock).mint(provider, testAmount);
                await mockToken.connect(await ethers.getSigner(provider))
                    .approve(liquidityPool.getAddress(), testAmount);

                // Provider should still be able to add liquidity
                await expect(liquidityPool.connect(await ethers.getSigner(provider))
                    .addLiquidity(await mockToken.getAddress(), testAmount))
                    .to.emit(liquidityPool, "LiquidityAdded")
                    .withArgs(await mockToken.getAddress(), provider, testAmount);
            });
        });

        describe("Provider Blacklist", function () {
            it("Should only allow admin to set blacklist status", async function () {
                const { admin } = await getNamedAccounts();

                // Non-admin attempt should fail
                await expect(liquidityPool.connect(await ethers.getSigner(provider))
                    .setProviderBlacklist(nonProvider, true))
                    .to.be.rejectedWith("LiquidityPool: Must have admin role");

                // Admin should succeed
                await expect(liquidityPool.connect(await ethers.getSigner(admin))
                    .setProviderBlacklist(provider, true))
                    .to.emit(liquidityPool, "ProviderBlacklistUpdated")
                    .withArgs(provider, true);
            });

            it("Should prevent blacklisted addresses from adding liquidity", async function () {
                const { admin } = await getNamedAccounts();

                // Blacklist provider
                await liquidityPool.connect(await ethers.getSigner(admin))
                    .setProviderBlacklist(provider, true);

                // Attempt to add liquidity should fail
                await expect(liquidityPool.connect(await ethers.getSigner(provider))
                    .addLiquidity(await mockToken.getAddress(), testAmount))
                    .to.be.rejectedWith("Provider is blacklisted");
            });

            it("Should allow removing addresses from blacklist", async function () {
                const { admin } = await getNamedAccounts();

                // First blacklist
                await liquidityPool.connect(await ethers.getSigner(admin))
                    .setProviderBlacklist(provider, true);

                // Then remove from blacklist
                await expect(liquidityPool.connect(await ethers.getSigner(admin))
                    .setProviderBlacklist(provider, false))
                    .to.emit(liquidityPool, "ProviderBlacklistUpdated")
                    .withArgs(provider, false);

                await (mockToken as ERC20Mock).mint(provider, testAmount);
                await mockToken.connect(await ethers.getSigner(provider))
                    .approve(liquidityPool.getAddress(), testAmount);

                // Should be able to add liquidity again
                await expect(liquidityPool.connect(await ethers.getSigner(provider))
                    .addLiquidity(await mockToken.getAddress(), testAmount))
                    .to.emit(liquidityPool, "LiquidityAdded")
                    .withArgs(await mockToken.getAddress(), provider, testAmount);
            });

            it("Should maintain blacklist when toggling permissionless mode", async function () {
                const { admin } = await getNamedAccounts();

                // Blacklist provider
                await liquidityPool.connect(await ethers.getSigner(admin))
                    .setProviderBlacklist(provider, true);

                // Enable permissionless mode
                await liquidityPool.connect(await ethers.getSigner(admin))
                    .setPermissionlessLiquidity(true);

                // Provider should still be blocked
                await expect(liquidityPool.connect(await ethers.getSigner(provider))
                    .addLiquidity(await mockToken.getAddress(), testAmount))
                    .to.be.rejectedWith("Provider is blacklisted");
            });

            it("Should allow blacklisting in permissionless mode", async function () {
                const { admin } = await getNamedAccounts();

                // Enable permissionless mode first
                await liquidityPool.connect(await ethers.getSigner(admin))
                    .setPermissionlessLiquidity(true);

                // Blacklist non-provider
                await liquidityPool.connect(await ethers.getSigner(admin))
                    .setProviderBlacklist(nonProvider, true);

                // Attempt to add liquidity should fail
                await expect(liquidityPool.connect(await ethers.getSigner(nonProvider))
                    .addLiquidity(await mockToken.getAddress(), testAmount))
                    .to.be.rejectedWith("Provider is blacklisted");
            });
        });
    });

});