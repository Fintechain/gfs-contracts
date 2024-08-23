import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { CurrencyRegistry } from "../../typechain";  // Adjust import according to your contract path

describe("CurrencyRegistry", function () {
    let currencyRegistry: CurrencyRegistry;
    let currencyAdmin: string;
    const currencyCodeBTC = ethers.encodeBytes32String("BTC");
    const currencyCodeETH = ethers.encodeBytes32String("ETH");
    const invalidCurrencyCode = ethers.encodeBytes32String("INVALID");

    beforeEach(async function () {
        await deployments.fixture(['CurrencyRegistry']);

        const { admin } = await getNamedAccounts();
        currencyAdmin = admin;

        const CurrencyRegistryDeployment = await deployments.get('CurrencyRegistry');
        currencyRegistry = await ethers.getContractAt('CurrencyRegistry', CurrencyRegistryDeployment.address);

       // await currencyRegistry.connect(await ethers.getSigner(admin)).initialize(admin);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            expect(await currencyRegistry.hasRole(await currencyRegistry.DEFAULT_ADMIN_ROLE(), currencyAdmin)).to.be.true;
        });

        it("Should set the correct currency admin role", async function () {
            expect(await currencyRegistry.hasRole(await currencyRegistry.CURRENCY_ADMIN_ROLE(), currencyAdmin)).to.be.true;
        });
    });

    describe("Currency Management", function () {
        it("Should allow admin to add a currency", async function () {
            const currencyName = "Bitcoin";
            const currencyDecimals = 8;
            await currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).addCurrency(currencyCodeBTC, currencyName, currencyDecimals);

            const currency = await currencyRegistry.getCurrency(currencyCodeBTC);
            expect(currency.name).to.equal(currencyName);
            expect(currency.decimals).to.equal(currencyDecimals);
            expect(currency.active).to.be.true;
        });

        it("Should emit CurrencyAdded event when a currency is added", async function () {
            const currencyName = "Ethereum";
            const currencyDecimals = 18;
            await expect(currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).addCurrency(currencyCodeETH, currencyName, currencyDecimals))
                .to.emit(currencyRegistry, "CurrencyAdded")
                .withArgs(currencyCodeETH, currencyName, currencyDecimals);
        });

        it("Should revert when adding a currency with an invalid code", async function () {
            const currencyName = "InvalidCurrency";
            const currencyDecimals = 18;
            await expect(currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).addCurrency(ethers.ZeroHash, currencyName, currencyDecimals))
                .to.be.revertedWith("Invalid currency code");
        });

        it("Should revert when adding a currency with an empty name", async function () {
            const currencyDecimals = 18;
            await expect(currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).addCurrency(currencyCodeBTC, "", currencyDecimals))
                .to.be.revertedWith("Name cannot be empty");
        });

        it("Should revert when adding a currency with invalid decimals", async function () {
            await expect(currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).addCurrency(currencyCodeBTC, "Bitcoin", 0))
                .to.be.revertedWith("Invalid decimals");

            await expect(currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).addCurrency(currencyCodeBTC, "Bitcoin", 19))
                .to.be.revertedWith("Invalid decimals");
        });

        it("Should revert when adding an existing currency", async function () {
            const currencyName = "Bitcoin";
            const currencyDecimals = 8;
            await currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).addCurrency(currencyCodeBTC, currencyName, currencyDecimals);

            await expect(currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).addCurrency(currencyCodeBTC, currencyName, currencyDecimals))
                .to.be.revertedWith("Currency already exists");
        });
    });

    describe("Currency Status Management", function () {
        beforeEach(async function () {
            const currencyName = "Bitcoin";
            const currencyDecimals = 8;
            await currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).addCurrency(currencyCodeBTC, currencyName, currencyDecimals);
        });

        it("Should allow admin to update the status of a currency", async function () {
            await currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).updateCurrencyStatus(currencyCodeBTC, false);
            const currency = await currencyRegistry.getCurrency(currencyCodeBTC);
            expect(currency.active).to.be.false;
        });

        it("Should emit CurrencyStatusUpdated event when the currency status is updated", async function () {
            await expect(currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).updateCurrencyStatus(currencyCodeBTC, false))
                .to.emit(currencyRegistry, "CurrencyStatusUpdated")
                .withArgs(currencyCodeBTC, false);
        });

        it("Should revert when updating the status to the same value", async function () {
            await expect(currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).updateCurrencyStatus(currencyCodeBTC, true))
                .to.be.revertedWith("Status already set");
        });

        it("Should revert when trying to update the status of a non-existent currency", async function () {
            await expect(currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).updateCurrencyStatus(invalidCurrencyCode, false))
                .to.be.revertedWith("Currency does not exist");
        });
    });

    describe("Access Control", function () {
        it("Should revert when a non-admin tries to add a currency", async function () {
            const { user } = await getNamedAccounts();
            const currencyName = "Ethereum";
            const currencyDecimals = 18;

            await expect(currencyRegistry.connect(await ethers.getSigner(user)).addCurrency(currencyCodeETH, currencyName, currencyDecimals))
                .to.be.revertedWithCustomError(
                    currencyRegistry,
                    "AccessControlUnauthorizedAccount"
                ).withArgs(user, await currencyRegistry.CURRENCY_ADMIN_ROLE());
        });

        it("Should revert when a non-admin tries to update a currency's status", async function () {
            const { user } = await getNamedAccounts();

            await expect(currencyRegistry.connect(await ethers.getSigner(user)).updateCurrencyStatus(currencyCodeBTC, false))
                .to.be.revertedWithCustomError(
                    currencyRegistry,
                    "AccessControlUnauthorizedAccount"
                ).withArgs(user, await currencyRegistry.CURRENCY_ADMIN_ROLE());
        });
    });

    describe("Pausable", function () {
        it("Should allow admin to pause the contract", async function () {
            await currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).pause();
            expect(await currencyRegistry.paused()).to.be.true;
        });

        it("Should allow admin to unpause the contract", async function () {
            await currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).pause();
            await currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).unpause();
            expect(await currencyRegistry.paused()).to.be.false;
        });

        it("Should revert when non-admin tries to pause the contract", async function () {
            const { user } = await getNamedAccounts();
            await expect(currencyRegistry.connect(await ethers.getSigner(user)).pause())
                .to.be.revertedWithCustomError(
                    currencyRegistry,
                    "AccessControlUnauthorizedAccount"
                ).withArgs(user, await currencyRegistry.DEFAULT_ADMIN_ROLE());
        });

        it("Should revert adding a currency when paused", async function () {
            const currencyName = "Ethereum";
            const currencyDecimals = 18;

            await currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).pause();

            await expect(currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).addCurrency(currencyCodeETH, currencyName, currencyDecimals))
                .to.be.revertedWithCustomError(
                    currencyRegistry,
                    "EnforcedPause"
                );
        });

        it("Should revert updating a currency's status when paused", async function () {
            await currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).pause();

            await expect(currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).updateCurrencyStatus(currencyCodeBTC, false))
                .to.be.revertedWithCustomError(
                    currencyRegistry,
                    "EnforcedPause"
                );
        });
    });

    describe("Currency Queries", function () {
        beforeEach(async function () {
            const currencyName = "Bitcoin";
            const currencyDecimals = 8;
            await currencyRegistry.connect(await ethers.getSigner(currencyAdmin)).addCurrency(currencyCodeBTC, currencyName, currencyDecimals);
        });

        it("Should return the correct currency details", async function () {
            const currency = await currencyRegistry.getCurrency(currencyCodeBTC);
            expect(currency.name).to.equal("Bitcoin");
            expect(currency.decimals).to.equal(8);
            expect(currency.active).to.be.true;
        });

        it("Should revert when querying a non-existent currency", async function () {
            await expect(currencyRegistry.getCurrency(invalidCurrencyCode))
                .to.be.revertedWith("Currency does not exist");
        });

        it("Should return the correct currency count", async function () {
            expect(await currencyRegistry.getCurrencyCount()).to.equal(1);
        });

        it("Should return all currencies", async function () {
            const [currencyCodes, currencies] = await currencyRegistry.getAllCurrencies();
            expect(currencyCodes.length).to.equal(1);
            expect(currencies.length).to.equal(1);
            expect(currencies[0].name).to.equal("Bitcoin");
        });
    });
});
