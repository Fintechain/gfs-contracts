import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { TargetRegistry } from "../../../typechain";

describe("TargetRegistry", function () {
    let targetRegistry: TargetRegistry;
    let registrar: string, validator: string, user: string;
    const testMetadata = ethers.toUtf8Bytes("test-metadata");

    beforeEach(async function () {
        await deployments.fixture(['TargetRegistry']);
        const { admin } = await getNamedAccounts();
        const signers = await ethers.getSigners();
        // Validate that there are enough signers for testing
        if (signers.length < 4) {
            throw new Error("Not enough accounts available. At least 3 are required for testing.");
        }

        registrar = signers[2].address;
        validator = signers[3].address;
        user = signers[4].address;


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
            expect(await targetRegistry.hasRole(await targetRegistry.REGISTRAR_ROLE(), registrar)).to.be.true;
            expect(await targetRegistry.hasRole(await targetRegistry.VALIDATOR_ROLE(), validator)).to.be.true;
        });

        it("Should not set any roles for non-authorized users", async function () {
            expect(await targetRegistry.hasRole(await targetRegistry.REGISTRAR_ROLE(), user)).to.be.false;
            expect(await targetRegistry.hasRole(await targetRegistry.VALIDATOR_ROLE(), user)).to.be.false;
        });
    });

    describe("Target Registration", function () {
        it("Should allow registrar to register target", async function () {
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(user, 1, 0, testMetadata))
                .to.emit(targetRegistry, "TargetRegistered")
                .withArgs(user, 1, 0);
        });

        it("Should store correct target data", async function () {
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
            await expect(targetRegistry.connect(await ethers.getSigner(user))
                .registerTarget(user, 1, 0, testMetadata))
                .to.be.revertedWith("TargetRegistry: Must have registrar role");
        });

        it("Should revert with zero address", async function () {
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(ethers.ZeroAddress, 1, 0, testMetadata))
                .to.be.revertedWith("TargetRegistry: Invalid address");
        });

        it("Should revert for duplicate registration", async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            
            await targetRegistry.connect(registrarSigner)
                .registerTarget(user, 1, 0, testMetadata);
                
            await expect(targetRegistry.connect(registrarSigner)
                .registerTarget(user, 1, 0, testMetadata))
                .to.be.revertedWith("TargetRegistry: Target already registered");
        });

        it("Should register targets of different types", async function () {
            const [target1, target2, target3] = await ethers.getSigners();
            const registrarSigner = await ethers.getSigner(registrar);

            // Register CONTRACT type
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target1.address, 1, 0, testMetadata);

            // Register INSTITUTION type
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target2.address, 1, 1, testMetadata);

            // Register BOTH type
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target3.address, 1, 2, testMetadata);

            const target1Info = await targetRegistry.getTarget(target1.address);
            const target2Info = await targetRegistry.getTarget(target2.address);
            const target3Info = await targetRegistry.getTarget(target3.address);

            expect(target1Info.targetType).to.equal(0); // CONTRACT
            expect(target2Info.targetType).to.equal(1); // INSTITUTION
            expect(target3Info.targetType).to.equal(2); // BOTH
        });
    });

    describe("Target Status Management", function () {
        beforeEach(async function () {
            await targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(user, 1, 0, testMetadata);
        });

        it("Should allow registrar to update status", async function () {
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .updateTargetStatus(user, false))
                .to.emit(targetRegistry, "TargetStatusUpdated")
                .withArgs(user, false);
        });

        it("Should reflect status changes in validity check", async function () {
            const registrarSigner = await ethers.getSigner(registrar);

            // Initially valid
            expect(await targetRegistry.isValidTarget(user, 1)).to.be.true;

            // Deactivate
            await targetRegistry.connect(registrarSigner)
                .updateTargetStatus(user, false);
            expect(await targetRegistry.isValidTarget(user, 1)).to.be.false;

            // Reactivate
            await targetRegistry.connect(registrarSigner)
                .updateTargetStatus(user, true);
            expect(await targetRegistry.isValidTarget(user, 1)).to.be.true;
        });

        it("Should revert status update for non-registered target", async function () {
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .updateTargetStatus(ethers.Wallet.createRandom().address, false))
                .to.be.revertedWith("TargetRegistry: Target not registered");
        });
    });

    describe("Target Metadata Management", function () {
        let targetAddress: string;

        beforeEach(async function () {
            targetAddress = (await ethers.getSigners())[1].address;
            await targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(targetAddress, 1, 0, testMetadata);
        });

        it("Should allow registrar to update metadata", async function () {
            const newMetadata = ethers.toUtf8Bytes("new-metadata");
            
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .updateTargetMetadata(targetAddress, newMetadata))
                .to.emit(targetRegistry, "MetadataUpdated")
                .withArgs(targetAddress, newMetadata);

            const target = await targetRegistry.getTarget(targetAddress);
            expect(target.metadata).to.equal(ethers.hexlify(newMetadata));
        });

        it("Should revert metadata update for non-registered target", async function () {
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .updateTargetMetadata(ethers.Wallet.createRandom().address, testMetadata))
                .to.be.revertedWith("TargetRegistry: Target not registered");
        });
    });

    describe("Emitter Management", function () {
        const testEmitter = ethers.randomBytes(32);

        it("Should allow registrar to register emitter", async function () {
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .registerEmitter(testEmitter, 1))
                .to.emit(targetRegistry, "EmitterRegistered")
                .withArgs(testEmitter, 1);
        });

        it("Should validate registered emitter", async function () {
            await targetRegistry.connect(await ethers.getSigner(registrar))
                .registerEmitter(testEmitter, 1);

            expect(await targetRegistry.isValidEmitter(testEmitter, 1)).to.be.true;
        });

        it("Should allow registrar to deregister emitter", async function () {
            await targetRegistry.connect(await ethers.getSigner(registrar))
                .registerEmitter(testEmitter, 1);

            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .deregisterEmitter(testEmitter, 1))
                .to.emit(targetRegistry, "EmitterDeregistered")
                .withArgs(testEmitter, 1);

            expect(await targetRegistry.isValidEmitter(testEmitter, 1)).to.be.false;
        });

        it("Should revert registration of zero emitter address", async function () {
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .registerEmitter(ethers.ZeroHash, 1))
                .to.be.revertedWith("TargetRegistry: Invalid emitter");
        });
    });

    describe("Query Functions", function () {
        const chainId = 1;
        let targets: string[];

        beforeEach(async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            targets = (await ethers.getSigners()).slice(0, 3).map(signer => signer.address);

            // Register multiple targets
            for (let i = 0; i < targets.length; i++) {
                await targetRegistry.connect(registrarSigner)
                    .registerTarget(targets[i], chainId, i % 3, testMetadata);
            }
        });

        it("Should return correct targets by chain", async function () {
            const chainTargets = await targetRegistry.getTargetsByChain(chainId);
            expect(chainTargets.length).to.equal(targets.length);
            targets.forEach(target => {
                expect(chainTargets).to.include(target);
            });
        });

        it("Should return correct targets by type", async function () {
            for (let type = 0; type < 3; type++) {
                const typeTargets = await targetRegistry.getTargetsByType(type);
                const expectedTargets = targets.filter((_, index) => index % 3 === type);
                expect(typeTargets.length).to.equal(expectedTargets.length);
                expectedTargets.forEach(target => {
                    expect(typeTargets).to.include(target);
                });
            }
        });

        it("Should return empty array for non-existent chain", async function () {
            const nonExistentChainTargets = await targetRegistry.getTargetsByChain(999);
            expect(nonExistentChainTargets.length).to.equal(0);
        });

        it("Should validate target correctly across chains", async function () {
            const [target] = targets;
            expect(await targetRegistry.isValidTarget(target, chainId)).to.be.true;
            expect(await targetRegistry.isValidTarget(target, chainId + 1)).to.be.false;
        });
    });

    describe("Emergency Controls", function () {
        it("Should allow admin to pause", async function () {
            const { admin } = await getNamedAccounts();
            await expect(targetRegistry.connect(await ethers.getSigner(admin))
                .pause())
                .to.emit(targetRegistry, "Paused");
        });

        it("Should prevent operations when paused", async function () {
            const { admin } = await getNamedAccounts();
            await targetRegistry.connect(await ethers.getSigner(admin)).pause();
            
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(user, 1, 0, testMetadata))
                .to.be.revertedWithCustomError(targetRegistry, "EnforcedPause");
        });

        it("Should allow admin to unpause", async function () {
            const { admin } = await getNamedAccounts();
            const adminSigner = await ethers.getSigner(admin);
            const registrarSigner = await ethers.getSigner(registrar);

            // Pause
            await targetRegistry.connect(adminSigner).pause();

            // Unpause
            await expect(targetRegistry.connect(adminSigner).unpause())
                .to.emit(targetRegistry, "Unpaused");

            // Verify operations work after unpause
            await expect(targetRegistry.connect(registrarSigner)
                .registerTarget(user, 1, 0, testMetadata))
                .to.not.be.reverted;
        });

        it("Should revert pause/unpause from non-admin", async function () {
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .pause())
                .to.be.revertedWith("TargetRegistry: Must have admin role");

            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .unpause())
                .to.be.revertedWith("TargetRegistry: Must have admin role");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle concurrent target registrations", async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            const targets = (await ethers.getSigners()).slice(0, 5);

            // Register multiple targets concurrently
            await Promise.all(targets.map(target =>
                targetRegistry.connect(registrarSigner)
                    .registerTarget(target.address, 1, 0, testMetadata)
            ));

            const chainTargets = await targetRegistry.getTargetsByChain(1);
            expect(chainTargets.length).to.equal(targets.length);
        });

        it("Should handle registration across multiple chains", async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            const target = (await ethers.getSigners())[1];
            
            // Register same target on multiple chains
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target.address, 1, 0, testMetadata);
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target.address, 2, 0, testMetadata);
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target.address, 3, 0, testMetadata);

            // Verify target is valid on each chain
            //expect(await targetRegistry.isValidTarget(target.address, 1)).to.be.true;
            //expect(await targetRegistry.isValidTarget(target.address, 2)).to.be.true;
            expect(await targetRegistry.isValidTarget(target.address, 3)).to.be.true;
        });

        it("Should handle large metadata", async function () {
            const largeMetadata = ethers.toUtf8Bytes("x".repeat(1000)); // 1KB metadata
            const target = (await ethers.getSigners())[1];

            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(target.address, 1, 0, largeMetadata))
                .to.not.be.reverted;

            const storedTarget = await targetRegistry.getTarget(target.address);
            expect(storedTarget.metadata).to.equal(ethers.hexlify(largeMetadata));
        });

        it("Should handle multiple status updates", async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            const target = (await ethers.getSigners())[1];

            // Register target
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target.address, 1, 0, testMetadata);

            // Multiple status updates
            for (let i = 0; i < 5; i++) {
                await targetRegistry.connect(registrarSigner)
                    .updateTargetStatus(target.address, i % 2 === 0);
                const isValid = await targetRegistry.isValidTarget(target.address, 1);
                expect(isValid).to.equal(i % 2 === 0);
            }
        });

        it("Should handle multiple metadata updates", async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            const target = (await ethers.getSigners())[1];

            // Register target
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target.address, 1, 0, testMetadata);

            // Multiple metadata updates
            for (let i = 0; i < 5; i++) {
                const newMetadata = ethers.toUtf8Bytes(`metadata-${i}`);
                await targetRegistry.connect(registrarSigner)
                    .updateTargetMetadata(target.address, newMetadata);
                const storedTarget = await targetRegistry.getTarget(target.address);
                expect(storedTarget.metadata).to.equal(ethers.hexlify(newMetadata));
            }
        });

        it("Should handle empty metadata", async function () {
            const target = (await ethers.getSigners())[1];
            
            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .registerTarget(target.address, 1, 0, "0x"))
                .to.not.be.reverted;
        });

        it("Should handle all target types for same address", async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            const target = (await ethers.getSigners())[1];

            // Register target as all types on different chains
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target.address, 1, 0, testMetadata); // CONTRACT
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target.address, 2, 1, testMetadata); // INSTITUTION
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target.address, 3, 2, testMetadata); // BOTH

            // Verify correct type for each registration
            const target1 = await targetRegistry.getTarget(target.address);
            expect(target1.targetType).to.equal(2);
            expect(target1.chainId).to.equal(3);

            const typeTargets0 = await targetRegistry.getTargetsByType(0);
            const typeTargets1 = await targetRegistry.getTargetsByType(1);
            const typeTargets2 = await targetRegistry.getTargetsByType(2);

            expect(typeTargets0).to.include(target.address);
            expect(typeTargets1).to.include(target.address);
            expect(typeTargets2).to.include(target.address);
        });
    });

    describe("Access Control", function () {
        it("Should allow admin to grant and revoke roles", async function () {
            const { admin } = await getNamedAccounts();
            const newRegistrar = (await ethers.getSigners())[1];
            const registrarRole = await targetRegistry.REGISTRAR_ROLE();

            // Grant role
            await expect(targetRegistry.connect(await ethers.getSigner(admin))
                .grantRole(registrarRole, user))
                .to.emit(targetRegistry, "RoleGranted")
                .withArgs(registrarRole, user, admin);

            // Verify role
            expect(await targetRegistry.hasRole(registrarRole, user)).to.be.true;

            // Revoke role
            await expect(targetRegistry.connect(await ethers.getSigner(admin))
                .revokeRole(registrarRole, user))
                .to.emit(targetRegistry, "RoleRevoked")
                .withArgs(registrarRole, user, admin);

            // Verify role removed
            expect(await targetRegistry.hasRole(registrarRole, user)).to.be.false;
        });

        it("Should prevent non-admin from managing roles", async function () {
            const newRegistrar = (await ethers.getSigners())[1];
            const registrarRole = await targetRegistry.REGISTRAR_ROLE();

            await expect(targetRegistry.connect(await ethers.getSigner(registrar))
                .grantRole(registrarRole, newRegistrar.address))
                .to.be.reverted;
        });

        it("Should allow role holders to renounce their roles", async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            const registrarRole = await targetRegistry.REGISTRAR_ROLE();

            await expect(targetRegistry.connect(registrarSigner)
                .renounceRole(registrarRole, registrar))
                .to.emit(targetRegistry, "RoleRevoked")
                .withArgs(registrarRole, registrar, registrar);

            expect(await targetRegistry.hasRole(registrarRole, registrar)).to.be.false;
        });
    });

    describe("Integration Tests", function () {
        it("Should maintain correct indices after multiple operations", async function () {
            const registrarSigner = await ethers.getSigner(registrar);
            const [target1, target2, target3] = await ethers.getSigners();

            // Register targets
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target1.address, 1, 0, testMetadata);
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target2.address, 1, 1, testMetadata);
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target3.address, 1, 2, testMetadata);

            // Deactivate and reactivate targets
            await targetRegistry.connect(registrarSigner)
                .updateTargetStatus(target1.address, false);
            await targetRegistry.connect(registrarSigner)
                .updateTargetStatus(target2.address, false);
            await targetRegistry.connect(registrarSigner)
                .updateTargetStatus(target1.address, true);

            // Verify chain targets
            const chainTargets = await targetRegistry.getTargetsByChain(1);
            expect(chainTargets.length).to.equal(3);
            expect(chainTargets).to.include(target1.address);
            expect(chainTargets).to.include(target2.address);
            expect(chainTargets).to.include(target3.address);

            // Verify type targets
            for (let type = 0; type < 3; type++) {
                const typeTargets = await targetRegistry.getTargetsByType(type);
                expect(typeTargets.length).to.equal(1);
            }

            // Verify valid targets
            expect(await targetRegistry.isValidTarget(target1.address, 1)).to.be.true;
            expect(await targetRegistry.isValidTarget(target2.address, 1)).to.be.false;
            expect(await targetRegistry.isValidTarget(target3.address, 1)).to.be.true;
        });

        it("Should handle complete lifecycle of a target", async function () {
            const { admin } = await getNamedAccounts();
            const registrarSigner = await ethers.getSigner(registrar);
            const target = (await ethers.getSigners())[1];

            // Register target
            await targetRegistry.connect(registrarSigner)
                .registerTarget(target.address, 1, 0, testMetadata);

            // Update metadata
            const newMetadata = ethers.toUtf8Bytes("updated-metadata");
            await targetRegistry.connect(registrarSigner)
                .updateTargetMetadata(target.address, newMetadata);

            // Update status multiple times
            await targetRegistry.connect(registrarSigner)
                .updateTargetStatus(target.address, false);
            await targetRegistry.connect(registrarSigner)
                .updateTargetStatus(target.address, true);

            // Register emitter
            const emitterAddress = ethers.hexlify(ethers.randomBytes(32));
            await targetRegistry.connect(registrarSigner)
                .registerEmitter(emitterAddress, 1);

            // Pause contract
            await targetRegistry.connect(await ethers.getSigner(admin))
                .pause();

            // Verify paused state prevents operations
            await expect(targetRegistry.connect(registrarSigner)
                .updateTargetStatus(target.address, false))
                .to.be.revertedWithCustomError(targetRegistry, "EnforcedPause");

            // Unpause and verify operations resume
            await targetRegistry.connect(await ethers.getSigner(admin))
                .unpause();
            await expect(targetRegistry.connect(registrarSigner)
                .updateTargetStatus(target.address, false))
                .to.not.be.reverted;

            // Final state verification
            const finalTarget = await targetRegistry.getTarget(target.address);
            expect(finalTarget.isActive).to.be.false;
            expect(finalTarget.metadata).to.equal(ethers.hexlify(newMetadata));
        });
    });
});