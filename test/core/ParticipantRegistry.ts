import { ethers, deployments, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ParticipantRegistry, ParticipantRegistry__factory } from "../../typechain";

describe("ParticipantRegistry", function () {
    let participantRegistry: ParticipantRegistry;
    let admin: string;
    let manager: string;
    let participant1: string;
    let participant2: string;

    beforeEach(async function () {

        await deployments.fixture(['ParticipantRegistry', 'Tokens']);

        let { platformAdmin, user, user2 } = await getNamedAccounts();
        
        participant1 = user;
        participant2 = user2;
        admin = platformAdmin;
        manager = platformAdmin;

        const ParticipantRegistryDeployment = await deployments.get('ParticipantRegistry');
        participantRegistry = await ethers.getContractAt('ParticipantRegistry', ParticipantRegistryDeployment.address);

    });

    describe("Initialization", function () {
        it("should set the admin role correctly", async function () {
            expect(await participantRegistry.hasRole(await participantRegistry.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
            expect(await participantRegistry.hasRole(await participantRegistry.ADMIN_ROLE(), admin)).to.be.true;
        });

        it("should not allow the contract to be initialized again", async function () {
            await expect(participantRegistry.initialize(admin))
            .to.be.revertedWithCustomError(
                participantRegistry,
                "InvalidInitialization"
            );
        });
    });

    describe("Participant Registration", function () {
        it("should register a participant correctly", async function () {
            await participantRegistry.connect(await ethers.getSigner(participant1)).registerParticipant("Participant One");

            const participant = await participantRegistry.getParticipant(participant1);
            expect(participant.name).to.equal("Participant One");
            expect(participant.status).to.equal(0); // 0 is ParticipantStatus.Active
        });

        it("should revert if the participant tries to register again", async function () {
            await participantRegistry.connect(await ethers.getSigner(participant1)).registerParticipant("Participant One");
            await expect(participantRegistry.connect(await ethers.getSigner(participant1)).registerParticipant("Participant One"))
                .to.be.revertedWith("Participant already registered");
        });

        it("should revert if the name is empty", async function () {
            await expect(participantRegistry.connect(
                await ethers.getSigner(participant1)).registerParticipant(""))
                .to.be.revertedWith("Name cannot be empty");
        });
    });

    describe("Participant Status Update", function () {
        beforeEach(async function () {
            await participantRegistry.connect(
                await ethers.getSigner(participant1)).registerParticipant("Participant One");

            await participantRegistry.connect(await ethers.getSigner(admin)).addManager(manager);
        });

        it("should update the participant status correctly by admin", async function () {
            await participantRegistry.connect(
                await ethers.getSigner(admin)).updateParticipantStatus(participant1, 1); // 1 is ParticipantStatus.Inactive

            const participant = await participantRegistry.getParticipant(participant1);
            expect(participant.status).to.equal(1);
        });

        it("should update the participant status correctly by manager", async function () {
            await participantRegistry.connect(
                await ethers.getSigner(manager)).updateParticipantStatus(participant1, 1); // Inactive

            const participant = await participantRegistry.getParticipant(participant1);
            expect(participant.status).to.equal(1);
        });

        it("should revert if the participant does not exist", async function () {
            await expect(
                participantRegistry.connect(
                    await ethers.getSigner(admin)).updateParticipantStatus(participant2, 1)
            )
            .to.be.revertedWith("Participant does not exist");
        });

        it("should revert if the status is the same as the current status", async function () {
            await expect(
                participantRegistry.connect(
                    await ethers.getSigner(admin)).updateParticipantStatus(participant1, 0)
            ) // Active (already active)
            .to.be.revertedWith("New status must be different");
        });

        it("should revert if a non-admin or non-manager tries to update status", async function () {
            await expect(participantRegistry.connect(
                await ethers.getSigner(participant2)).updateParticipantStatus(participant1, 1))
                .to.be.revertedWith("Caller is not an admin or manager");
        });
    });

    describe("Participant Queries", function () {
        beforeEach(async function () {
            await participantRegistry.connect(
                await ethers.getSigner(participant1)).registerParticipant("Participant One");
            await participantRegistry.connect(
                await ethers.getSigner(participant2)).registerParticipant("Participant Two");
        });

        it("should return correct participant count", async function () {
            expect(await participantRegistry.getParticipantCount()).to.equal(2);
        });

        it("should return correct participant details", async function () {
            const participant = await participantRegistry.getParticipant(participant1);
            expect(participant.name).to.equal("Participant One");
            expect(participant.status).to.equal(0); // Active
        });

        it("should return all participants correctly", async function () {
            const participants = await participantRegistry.getAllParticipants();
            expect(participants.length).to.equal(2);
            expect(participants[0].name).to.equal("Participant One");
            expect(participants[1].name).to.equal("Participant Two");
        });

        it("should correctly check if a participant is active", async function () {
            expect(await participantRegistry.isActiveParticipant(participant1)).to.be.true;

            await participantRegistry.connect(
                await ethers.getSigner(admin)).updateParticipantStatus(participant1, 1); // Inactive
                
            expect(await participantRegistry.isActiveParticipant(participant1)).to.be.false;
        });
    });

    describe("Role Management", function () {
        it("should allow admin to add and remove managers", async function () {
            await participantRegistry.connect(
                await ethers.getSigner(admin)).addManager(manager);

            expect(await participantRegistry.hasRole(
                await participantRegistry.MANAGER_ROLE(), manager)).to.be.true;

            await participantRegistry.connect(
                await ethers.getSigner(admin)).removeManager(manager);

            expect(await participantRegistry.hasRole(
                await participantRegistry.MANAGER_ROLE(), manager)).to.be.false;
        });

        it("should revert if a non-admin tries to add a manager", async function () {
            await expect(participantRegistry.connect(await ethers.getSigner(participant1)).addManager(manager))
            .to.be.revertedWithCustomError(
                participantRegistry,
                "AccessControlUnauthorizedAccount"
            );
        });
    });

    describe("Pause/Unpause", function () {
        it("should allow admin to pause and unpause the contract", async function () {
            await participantRegistry.connect(
                await ethers.getSigner(admin)).pause();

            expect(await participantRegistry.paused()).to.be.true;

            await participantRegistry.connect(
                await ethers.getSigner(admin)).unpause();

            expect(await participantRegistry.paused()).to.be.false;
        });

        it("should revert if non-admin tries to pause/unpause", async function () {
            await expect(participantRegistry.connect(
                await ethers.getSigner(participant1)).pause())
                .to.be.revertedWithCustomError(
                    participantRegistry,
                    "AccessControlUnauthorizedAccount"
                );
                
            await participantRegistry.connect(await ethers.getSigner(admin)).pause();

            await expect(participantRegistry.connect(await ethers.getSigner(participant1)).unpause())
                .to.be.revertedWithCustomError(
                    participantRegistry,
                    "AccessControlUnauthorizedAccount"
                );
        });
    });
});
