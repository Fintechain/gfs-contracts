import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { CollateralManager } from "../../typechain";  // Adjust import according to your contract path
import { ERC20Token } from "../../typechain"; // Adjust import according to your contract path

describe("CollateralManager", function () {
    let collateralManager: CollateralManager;
    let mockERC20: ERC20Token;
    let mockERC20Address: string;
    let collateralManagerAddress: string;
    const assetType = ethers.encodeBytes32String("BTC");

    beforeEach(async function () {
        await deployments.fixture(['CollateralManager', 'Tokens']);

        const { admin, user } = await getNamedAccounts();

        const CollateralManagerDeployment = await deployments.get('CollateralManager');
        collateralManager = await ethers.getContractAt('CollateralManager', CollateralManagerDeployment.address);
        collateralManagerAddress = CollateralManagerDeployment.address;

        const mockERC20Deployment = await deployments.get('ERC20Token');
        mockERC20 = await ethers.getContractAt('ERC20Token', mockERC20Deployment.address);
        mockERC20Address = mockERC20Deployment.address;


        await mockERC20.connect(await ethers.getSigner(admin)).mint(user, 5000);

        await collateralManager.connect(await ethers.getSigner(admin)).addAssetType(assetType, mockERC20Address);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await collateralManager.hasRole(await collateralManager.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
        });
    });

    describe("Asset Management", function () {
        it("Should add an asset type", async function () {
            const { admin } = await getNamedAccounts();
            const assetTypeNew = ethers.encodeBytes32String("ETH");
            await collateralManager.connect(await ethers.getSigner(admin)).addAssetType(assetTypeNew, mockERC20Address);
            expect(await collateralManager.getAssetAddress(assetTypeNew)).to.equal(mockERC20Address);
        });

        it("Should revert when adding an existing asset type", async function () {
            const { admin } = await getNamedAccounts();
            await expect(collateralManager.connect(await ethers.getSigner(admin)).addAssetType(assetType, mockERC20Address))
                .to.be.revertedWith("Asset type already exists");
        });
    });

    describe("Collateral Deposit", function () {
        it("Should allow a user to deposit collateral", async function () {
            const { user } = await getNamedAccounts();
            await mockERC20.connect(await ethers.getSigner(user)).approve(collateralManagerAddress, 1000);
            await collateralManager.connect(await ethers.getSigner(user)).depositCollateral(assetType, 1000);
            expect((await collateralManager.getCollateralAmount(user, assetType)).toString()).to.equal("1000");
        });

        it("Should emit CollateralDeposited event", async function () {
            const { user } = await getNamedAccounts();
            await mockERC20.connect(await ethers.getSigner(user)).approve(collateralManagerAddress, 1000);
            await expect(collateralManager.connect(await ethers.getSigner(user)).depositCollateral(assetType, 1000))
                .to.emit(collateralManager, "CollateralDeposited")
                .withArgs(user, assetType, 1000);
        });

        it("Should revert if asset type is invalid", async function () {
            const { user } = await getNamedAccounts();
            const invalidAssetType = ethers.encodeBytes32String("INVALID");
            await expect(collateralManager.connect(await ethers.getSigner(user)).depositCollateral(invalidAssetType, 1000))
                .to.be.revertedWith("Invalid asset type");
        });
    });

    describe("Collateral Withdrawal", function () {
        beforeEach(async function () {
            const { user } = await getNamedAccounts();
            await mockERC20.connect(await ethers.getSigner(user)).approve(collateralManagerAddress, 1000);
            await collateralManager.connect(await ethers.getSigner(user)).depositCollateral(assetType, 1000);
        });

        it("Should allow a user to withdraw collateral", async function () {
            const { user } = await getNamedAccounts();
            await collateralManager.connect(await ethers.getSigner(user)).withdrawCollateral(assetType, 500);
            expect((await collateralManager.getCollateralAmount(user, assetType)).toString()).to.equal("500");
        });

        it("Should emit CollateralWithdrawn event", async function () {
            const { user } = await getNamedAccounts();
            await expect(collateralManager.connect(await ethers.getSigner(user)).withdrawCollateral(assetType, 500))
                .to.emit(collateralManager, "CollateralWithdrawn")
                .withArgs(user, assetType, 500);
        });

        it("Should revert if collateral is insufficient", async function () {
            const { user } = await getNamedAccounts();
            await expect(collateralManager.connect(await ethers.getSigner(user)).withdrawCollateral(assetType, 1500))
                .to.be.revertedWith("Insufficient collateral");
        });
    });

    describe("Collateral Value Management", function () {
        beforeEach(async function () {
            const { user, admin } = await getNamedAccounts();
            await mockERC20.connect(await ethers.getSigner(user)).approve(collateralManagerAddress, 1000);
            await collateralManager.connect(await ethers.getSigner(user)).depositCollateral(assetType, 1000);
        });

        it("Should allow updater to update collateral value", async function () {
            const { admin, user } = await getNamedAccounts();
            await collateralManager.connect(await ethers.getSigner(admin)).updateCollateralValue(user, assetType, 5000);
            expect((await collateralManager.getCollateralValue(user, assetType)).toString()).to.equal("5000");
        });

        it("Should emit CollateralValueUpdated event", async function () {
            const { admin, user } = await getNamedAccounts();
            await expect(collateralManager.connect(await ethers.getSigner(admin)).updateCollateralValue(user, assetType, 5000))
                .to.emit(collateralManager, "CollateralValueUpdated")
                .withArgs(user, assetType, 5000);
        });

        it("Should revert if non-updater tries to update collateral value", async function () {
            const { user } = await getNamedAccounts();
            const updaterRole = await collateralManager.UPDATER_ROLE();

            await expect(collateralManager.connect(await ethers.getSigner(user)).updateCollateralValue(user, assetType, 5000))
                .to.be.revertedWithCustomError(
                    collateralManager,
                    "AccessControlUnauthorizedAccount"
                ).withArgs(user, updaterRole);;
        });
    });

    describe("Access Control", function () {
        it("Should revert if non-admin tries to add asset type", async function () {
            const { user } = await getNamedAccounts();
            const adminRole = await collateralManager.DEFAULT_ADMIN_ROLE();

            await expect(collateralManager.connect(await ethers.getSigner(user)).addAssetType(assetType, mockERC20Address))
                .to.be.revertedWithCustomError(
                    collateralManager,
                    "AccessControlUnauthorizedAccount"
                ).withArgs(user, adminRole);
        });
    });
});
