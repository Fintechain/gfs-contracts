import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { AccountManager } from "../../typechain";  // Adjust import according to your contract path

describe("AccountManager", function () {
    let accountManager: AccountManager;

    const currency = ethers.encodeBytes32String("USD");

    beforeEach(async function () {
        // Deploy contracts specified in AccountManager fixture
        await deployments.fixture(['AccountManager']);

        // Get named accounts
        const { platformAdmin, manager, user } = await getNamedAccounts();

        // Get the deployed contract
        const AccountManagerDeployment = await deployments.get('AccountManager');
        accountManager = await ethers.getContractAt('AccountManager', AccountManagerDeployment.address);

        // Grant manager role
        await accountManager.connect(await ethers.getSigner(platformAdmin)).grantRole(await accountManager.MANAGER_ROLE(), manager);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { platformAdmin } = await getNamedAccounts();
            expect(await accountManager.hasRole(await accountManager.DEFAULT_ADMIN_ROLE(), platformAdmin)).to.be.true;
        });

        it("Should set the correct manager", async function () {
            const { manager } = await getNamedAccounts();
            expect(await accountManager.hasRole(await accountManager.MANAGER_ROLE(), manager)).to.be.true;
        });
    });

    describe("Account Creation", function () {
        it("Should allow a user to create an account", async function () {
            const { user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(user)).createAccount(currency);
            expect((await accountManager.getBalance(user, currency)).toString()).to.equal("0");
        });

        it("Should emit AccountCreated event", async function () {
            const { user } = await getNamedAccounts();
            await expect(accountManager.connect(await ethers.getSigner(user)).createAccount(currency))
                .to.emit(accountManager, "AccountCreated")
                .withArgs(user, currency);
        });

        it("Should revert if an account already exists", async function () {
            const { user } = await getNamedAccounts();
            await accountManager.connect(
                await ethers.getSigner(user)).createAccount(currency);
            await expect(accountManager.connect(
                await ethers.getSigner(user)).createAccount(currency)).to.be.revertedWith("Account already exists");
        });
    });

    describe("Balance Management", function () {
        beforeEach(async function () {
            const { user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(user)).createAccount(currency);
        });

        it("Should allow manager to credit balance", async function () {
            const { manager, user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(manager)).updateBalance(user, currency, 1000, true);
            expect((await accountManager.getBalance(user, currency))).to.equal(1000);
        });

        it("Should emit BalanceUpdated event on credit", async function () {
            const { manager, user } = await getNamedAccounts();
            await expect(accountManager.connect(await ethers.getSigner(manager)).updateBalance(user, currency, 1000, true))
                .to.emit(accountManager, "BalanceUpdated")
                .withArgs(user, currency, 1000);
        });

        it("Should allow manager to debit balance", async function () {
            const { manager, user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(manager)).updateBalance(user, currency, 1000, true);
            await accountManager.connect(await ethers.getSigner(manager)).updateBalance(user, currency, 500, false);
            expect((await accountManager.getBalance(user, currency))).to.equal(500);
        });

        it("Should emit BalanceUpdated event on debit", async function () {
            const { manager, user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(manager)).updateBalance(user, currency, 1000, true);
            await expect(accountManager.connect(await ethers.getSigner(manager)).updateBalance(user, currency, 500, false))
                .to.emit(accountManager, "BalanceUpdated")
                .withArgs(user, currency, 500);
        });

        it("Should revert debit if balance is insufficient", async function () {
            const { manager, user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(manager)).updateBalance(user, currency, 1000, true);
            await expect(accountManager.connect(await ethers.getSigner(manager)).updateBalance(user, currency, 2000, false)).to.be.revertedWith("Insufficient balance");
        });
    });

    describe("Liquidity Management", function () {
        beforeEach(async function () {
            const { user, manager } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(user)).createAccount(currency);
            await accountManager.connect(await ethers.getSigner(manager)).updateBalance(user, currency, 1000, true);
        });

        it("Should allow manager to reserve liquidity", async function () {
            const { manager, user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(manager)).reserveLiquidity(user, currency, 500);
            expect((await accountManager.getAvailableLiquidity(user, currency))).to.equal(500);
        });

        it("Should emit LiquidityReserved event", async function () {
            const { manager, user } = await getNamedAccounts();
            await expect(accountManager.connect(await ethers.getSigner(manager)).reserveLiquidity(user, currency, 500))
                .to.emit(accountManager, "LiquidityReserved")
                .withArgs(user, currency, 500);
        });

        it("Should revert if liquidity is insufficient", async function () {
            const { manager, user } = await getNamedAccounts();
            await expect(accountManager.connect(await ethers.getSigner(manager)).reserveLiquidity(user, currency, 1500)).to.be.revertedWith("Insufficient available liquidity");
        });

        it("Should allow manager to release liquidity", async function () {
            const { manager, user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(manager)).reserveLiquidity(user, currency, 500);
            await accountManager.connect(await ethers.getSigner(manager)).releaseLiquidity(user, currency, 500);
            expect((await accountManager.getAvailableLiquidity(user, currency))).to.equal(1000);
        });

        it("Should emit LiquidityReleased event", async function () {
            const { manager, user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(manager)).reserveLiquidity(user, currency, 500);
            await expect(accountManager.connect(await ethers.getSigner(manager)).releaseLiquidity(user, currency, 500))
                .to.emit(accountManager, "LiquidityReleased")
                .withArgs(user, currency, 500);
        });

        it("Should revert if releasing more liquidity than reserved", async function () {
            const { manager, user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(manager)).reserveLiquidity(user, currency, 500);
            await expect(accountManager.connect(await ethers.getSigner(manager)).releaseLiquidity(user, currency, 1000)).to.be.revertedWith("Insufficient reserved liquidity");
        });
    });

    describe("Access Control", function () {
        it("Should revert if non-manager tries to update balance", async function () {
            const { user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(user)).createAccount(currency);
            await expect(accountManager.connect(await ethers.getSigner(user)).updateBalance(user, currency, 1000, true)).to.be.revertedWith("Caller is not a manager");
        });

        it("Should revert if non-manager tries to reserve liquidity", async function () {
            const { user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(user)).createAccount(currency);
            await expect(accountManager.connect(await ethers.getSigner(user)).reserveLiquidity(user, currency, 1000)).to.be.revertedWith("Caller is not a manager");
        });

        it("Should revert if non-manager tries to release liquidity", async function () {
            const { user } = await getNamedAccounts();
            await accountManager.connect(await ethers.getSigner(user)).createAccount(currency);
            await expect(accountManager.connect(await ethers.getSigner(user)).releaseLiquidity(user, currency, 1000)).to.be.revertedWith("Caller is not a manager");
        });
    });
});
