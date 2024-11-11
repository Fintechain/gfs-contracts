import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { TargetRegistry } from "../../typechain";

describe("TargetRegistry", function () {
    let targetRegistry: TargetRegistry;
    const testMetadata = ethers.toUtf8Bytes("test-metadata");

    beforeEach(async function () {
        await deployments.fixture(['TargetRegistry']);

        const { admin, registrar, validator, user } = await getNamedAccounts();

        const TargetRegistryDeployment = await deployments.get('TargetRegistry');
        targetRegistry = await ethers.getContractAt('TargetRegistry', TargetRegistryDeployment.address);

        // Grant roles
        const registrarRole = await targetRegistry.REGISTRAR_ROLE();
        const validatorRole = await targetRegistry.VALIDATOR_ROLE();

        await targetRegistry.connect(await ethers.getSigner(admin)).grantRole(registrarRole, registrar);
        await targetRegistry.connect(await ethers.getSigner(admin)).grantRole(validatorRole, validator);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await targetRegistry.hasRole(await targetRegistry.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
        });

        it("Should set initial roles correctly", async function () {
            const { registrar, validator } = await getNamedAccounts();
            expect(await targetRegistry.hasRole(await targetRegistry.REGISTRAR_ROLE(), registrar)).to.be.true;
            expect(await targetRegistry.hasRole(await targetRegistry.VALIDATOR_ROLE(), validator)).to.be.true;
        });
    });

    describe("Target Registration", function () {
        it("Should allow registrar to register target", async function () {
            const { registrar, user } = await getNamedAccounts();
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(user, 1, 0, testMetadata))
                .to.emit(targetRegistry, "TargetRegistered")
                .withArgs(user, 1, 0);
        });

        it("Should store correct target data", async function () {
            const { registrar, user } = await getNamedAccounts();
            await targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(user, 1, 0, testMetadata);

            const target = await targetRegistry.getTarget(user);
            expect(target.addr).to.equal(user);
            expect(target.chainId).to.equal(1);
            expect(target.targetType).to.equal(0);
            expect(target.isActive).to.be.true;
            expect(target.metadata).to.equal(ethers.hexlify(testMetadata));
        });

        it("Should revert if non-registrar tries to register", async function () {
            const { user } = await getNamedAccounts();
            await expect(targetRegistry.connect(await ethers.getSigner(user))
                .registerTarget(user, 1, 0, testMetadata))
                .to.be.revertedWith("TargetRegistry: Must have registrar role");
        });

        it("Should revert with zero address", async function () {
            const { registrar } = await getNamedAccounts();
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(ethers.ZeroAddress, 1, 0, testMetadata))
                .to.be.revertedWith("TargetRegistry: Invalid address");
        });
    });

    describe("Target Status Management", function () {
        beforeEach(async function () {
            const { registrar, user } = await getNamedAccounts();
            await targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(user, 1, 0, testMetadata);
        });

        it("Should allow registrar to update status", async function () {
            const { registrar, user } = await getNamedAccounts();
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .updateTargetStatus(user, false))
                .to.emit(targetRegistry, "TargetStatusUpdated")
                .withArgs(user, false);
        });

        it("Should reflect status changes", async function () {
            const { registrar, user } = await getNamedAccounts();
            await targetRegistry.connect(await ethers.getSigner(registrar))
                .updateTargetStatus(user, false);

            expect(await targetRegistry.isValidTarget(user, 1)).to.be.false;
        });
    });

    describe("Emitter Management", function () {
        const testEmitter = ethers.randomBytes(32);

        it("Should allow registrar to register emitter", async function () {
            const { registrar } = await getNamedAccounts();
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .registerEmitter(testEmitter, 1))
                .to.emit(targetRegistry, "EmitterRegistered")
                .withArgs(testEmitter, 1);
        });

        it("Should validate registered emitter", async function () {
            const { registrar } = await getNamedAccounts();
            await targetRegistry.connect(await ethers.getSigner(registrar))
                .registerEmitter(testEmitter, 1);

            expect(await targetRegistry.isValidEmitter(testEmitter, 1)).to.be.true;
        });

        it("Should allow registrar to deregister emitter", async function () {
            const { registrar } = await getNamedAccounts();
            await targetRegistry.connect(await ethers.getSigner(registrar))
                .registerEmitter(testEmitter, 1);

            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .deregisterEmitter(testEmitter, 1))
                .to.emit(targetRegistry, "EmitterDeregistered")
                .withArgs(testEmitter, 1);

            expect(await targetRegistry.isValidEmitter(testEmitter, 1)).to.be.false;
        });
    });

    describe("Query Functions", function () {
        beforeEach(async function () {
            const { registrar, user } = await getNamedAccounts();
            await targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(user, 1, 0, testMetadata);
        });

        it("Should return correct targets by chain", async function () {
            const { user } = await getNamedAccounts();
            const chainTargets = await targetRegistry.getTargetsByChain(1);
            expect(chainTargets).to.include(user);
        });

        it("Should return correct targets by type", async function () {
            const { user } = await getNamedAccounts();
            const typeTargets = await targetRegistry.getTargetsByType(0);
            expect(typeTargets).to.include(user);
        });
    });

    describe("Emergency Controls", function () {
        it("Should allow admin to pause", async function () {
            const { admin } = await getNamedAccounts();
            await targetRegistry.connect(await ethers.getSigner(admin)).pause();
            expect(await targetRegistry.paused()).to.be.true;
        });

        it("Should prevent operations when paused", async function () {
            const { admin, registrar, user } = await getNamedAccounts();
            await targetRegistry.connect(await ethers.getSigner(admin)).pause();
            
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(user, 1, 0, testMetadata))
                .to.be.reverted;
        });

        it("Should allow admin to unpause", async function () {
            const { admin } =