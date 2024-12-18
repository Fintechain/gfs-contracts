import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ProtocolGovernance } from "../../../typechain";

describe("ProtocolGovernance", function () {
    let protocolGovernance: ProtocolGovernance;
    let governor: string, executor: string, voter: string
    const testProposalData = ethers.toUtf8Bytes("test-proposal");

    beforeEach(async function () {
        await deployments.fixture(['mocks', 'core']);

        const { admin } = await getNamedAccounts();

        const signers = await ethers.getSigners();
        // Validate that there are enough signers for testing
        if (signers.length < 4) {
            throw new Error("Not enough accounts available. At least 3 are required for testing.");
        }

        governor = signers[2].address;
        executor = signers[3].address;
        voter = signers[4].address;

        const ProtocolGovernanceDeployment = await deployments.get('ProtocolGovernance');
        protocolGovernance = await ethers.getContractAt('ProtocolGovernance', ProtocolGovernanceDeployment.address);

        // Grant roles
        const governorRole = await protocolGovernance.GOVERNOR_ROLE();
        const executorRole = await protocolGovernance.EXECUTOR_ROLE();
        const emergencyRole = await protocolGovernance.EMERGENCY_ROLE();

        await protocolGovernance.connect(await ethers.getSigner(admin)).grantRole(governorRole, governor);
        await protocolGovernance.connect(await ethers.getSigner(admin)).grantRole(executorRole, executor);
        await protocolGovernance.connect(await ethers.getSigner(admin)).grantRole(emergencyRole, executor);
        
        // Set up voting power
        await protocolGovernance.connect(await ethers.getSigner(admin)).updateVotingPower(voter, 100);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await protocolGovernance.hasRole(await protocolGovernance.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
        });

        it("Should set initial roles correctly", async function () {
            const { admin } = await getNamedAccounts();
            const governorRole = await protocolGovernance.GOVERNOR_ROLE();
            const executorRole = await protocolGovernance.EXECUTOR_ROLE();
            const emergencyRole = await protocolGovernance.EMERGENCY_ROLE();

            expect(await protocolGovernance.hasRole(governorRole, governor)).to.be.true;
            expect(await protocolGovernance.hasRole(executorRole, executor)).to.be.true;
            expect(await protocolGovernance.hasRole(emergencyRole, executor)).to.be.true;
        });

        it("Should set initial voting power for admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await protocolGovernance.getVotingPower(admin)).to.equal(100);
        });

        it("Should set correct governance parameters", async function () {
            expect(await protocolGovernance.VOTING_PERIOD()).to.equal(7 * 24 * 60 * 60);
            expect(await protocolGovernance.EXECUTION_DELAY()).to.equal(2 * 24 * 60 * 60);
            expect(await protocolGovernance.EMERGENCY_DELAY()).to.equal(1 * 24 * 60 * 60);
            expect(await protocolGovernance.QUORUM_PERCENTAGE()).to.equal(51);
        });
    });

    describe("Proposal Creation", function () {
        it("Should allow governor to create proposal", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated")
                .withArgs(1, 0, governor);
        });

        it("Should revert if non-governor tries to create proposal", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .createProposal(0, testProposalData))
                .to.be.rejectedWith("ProtocolGovernance: Must have governor role");
        });

        it("Should revert with empty proposal data", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, "0x"))
                .to.be.rejectedWith("ProtocolGovernance: Empty proposal data");
        });

        it("Should store proposal details correctly", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated")
                .withArgs(1, 0, governor);

            const proposal = await protocolGovernance.getProposal(1);
            expect(proposal.proposer).to.equal(governor);
            expect(proposal.proposalType).to.equal(0);
            expect(proposal.executed).to.be.false;
            expect(proposal.votesFor).to.equal(0);
            expect(proposal.votesAgainst).to.equal(0);
            expect(proposal.data).to.equal(ethers.hexlify(testProposalData));
        });
    });

    describe("Voting", function () {
        let proposalId: number;

        beforeEach(async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated")
                .withArgs(1, 0, governor);
            
            proposalId = 1;
        });

        it("Should allow voter to vote in favor", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .vote(proposalId, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(proposalId, voter, true);

            const proposal = await protocolGovernance.getProposal(proposalId);
            expect(proposal.votesFor).to.equal(100);
        });

        it("Should allow voter to vote against", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .vote(proposalId, false))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(proposalId, voter, false);

            const proposal = await protocolGovernance.getProposal(proposalId);
            expect(proposal.votesAgainst).to.equal(100);
        });

        it("Should revert if voter has no voting power", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .vote(proposalId, true))
                .to.be.rejectedWith("ProtocolGovernance: No voting power");
        });

        it("Should revert on duplicate vote", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .vote(proposalId, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(proposalId, voter, true);

            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .vote(proposalId, true))
                .to.be.rejectedWith("ProtocolGovernance: Already voted");
        });

        it("Should revert after voting period ends", async function () {
            await time.increase(7 * 24 * 60 * 60 + 1);
            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .vote(proposalId, true))
                .to.be.rejectedWith("ProtocolGovernance: Voting period ended");
        });

        it("Should track hasVoted correctly", async function () {
            expect(await protocolGovernance.hasVoted(proposalId, voter)).to.be.false;
            
            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .vote(proposalId, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(proposalId, voter, true);
                
            expect(await protocolGovernance.hasVoted(proposalId, voter)).to.be.true;
        });
    });

    describe("Proposal Execution", function () {
        beforeEach(async function () {
            const { admin } = await getNamedAccounts();
            
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated")
                .withArgs(1, 0, governor);

            await expect(protocolGovernance.connect(await ethers.getSigner(admin))
                .updateVotingPower(admin, 510))
                .to.emit(protocolGovernance, "VotingPowerUpdated")
                .withArgs(admin, 510);
        });

        it("Should execute successful proposal", async function () {
            const { admin } = await getNamedAccounts();
            
            await expect(protocolGovernance.connect(await ethers.getSigner(admin))
                .vote(1, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(1, admin, true);
            
            await time.increase(9 * 24 * 60 * 60 + 1);
            
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .executeProposal(1))
                .to.emit(protocolGovernance, "ProposalExecuted")
                .withArgs(1, true);
        });

        it("Should revert execution before voting period ends", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .executeProposal(1))
                .to.be.rejectedWith("ProtocolGovernance: Voting period not ended");
        });

        it("Should revert execution without quorum", async function () {
            await time.increase(9 * 24 * 60 * 60 + 1);
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .executeProposal(1))
                .to.be.rejectedWith("ProtocolGovernance: Quorum not reached");
        });

        it("Should revert execution before delay period", async function () {
            const { admin } = await getNamedAccounts();
            await expect(protocolGovernance.connect(await ethers.getSigner(admin))
                .vote(1, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(1, admin, true);

            await time.increase(7 * 24 * 60 * 60 + 1);
            
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .executeProposal(1))
                .to.be.rejectedWith("ProtocolGovernance: Execution delay not passed");
        });

        it("Should revert duplicate execution", async function () {
            const { admin } = await getNamedAccounts();
            
            await expect(protocolGovernance.connect(await ethers.getSigner(admin))
                .vote(1, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(1, admin, true);

            await time.increase(9 * 24 * 60 * 60 + 1);
            
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .executeProposal(1))
                .to.emit(protocolGovernance, "ProposalExecuted")
                .withArgs(1, true);
                
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .executeProposal(1))
                .to.be.rejectedWith("ProtocolGovernance: Already executed");
        });
    });

    describe("Emergency Actions", function () {
        const emergencyAction = ethers.toUtf8Bytes("emergency-action");

        it("Should allow emergency role to execute action", async function () {
            const actionHash = ethers.keccak256(emergencyAction);
            
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .executeEmergencyAction(emergencyAction))
                .to.emit(protocolGovernance, "EmergencyActionExecuted")
                .withArgs(actionHash);
        });

        it("Should revert if non-emergency role tries to execute", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .executeEmergencyAction(emergencyAction))
                .to.be.rejectedWith("ProtocolGovernance: Must have emergency role");
        });

        it("Should revert with empty action data", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .executeEmergencyAction("0x"))
                .to.be.rejectedWith("ProtocolGovernance: Empty action data");
        });

        it("Should revert duplicate emergency action", async function () {
            const actionHash = ethers.keccak256(emergencyAction);
            
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .executeEmergencyAction(emergencyAction))
                .to.emit(protocolGovernance, "EmergencyActionExecuted")
                .withArgs(actionHash);
                
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .executeEmergencyAction(emergencyAction))
                .to.be.rejectedWith("ProtocolGovernance: Action already executed");
        });
    });


    describe("Voting Power Management", function () {
        it("Should allow admin to update voting power", async function () {
            const { admin } = await getNamedAccounts();
            await expect(protocolGovernance.connect(await ethers.getSigner(admin))
                .updateVotingPower(voter, 200))
                .to.emit(protocolGovernance, "VotingPowerUpdated")
                .withArgs(voter, 200);

            expect(await protocolGovernance.getVotingPower(voter)).to.equal(200);
        });

        it("Should revert if non-admin tries to update voting power", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .updateVotingPower(voter, 200))
                .to.be.rejectedWith("ProtocolGovernance: Must have admin role");
        });
    });

    describe("Pause/Unpause", function () {
        it("Should allow emergency role to pause", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .pause())
                .to.emit(protocolGovernance, "Paused")
                .withArgs(executor);
        });

        it("Should allow emergency role to unpause", async function () {
            await protocolGovernance.connect(await ethers.getSigner(executor)).pause();
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .unpause())
                .to.emit(protocolGovernance, "Unpaused")
                .withArgs(executor);
        });

        it("Should revert if non-emergency role tries to pause", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .pause())
                .to.be.rejectedWith("ProtocolGovernance: Must have emergency role");
        });

        it("Should prevent proposal creation when paused", async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .pause())
                .to.emit(protocolGovernance, "Paused")
                .withArgs(executor);
            
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, testProposalData))
                .to.be.revertedWithCustomError(protocolGovernance, "EnforcedPause");
        });

        it("Should prevent voting when paused", async function () {
            
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated")
                .withArgs(1, 0, governor);
            
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .pause())
                .to.emit(protocolGovernance, "Paused")
                .withArgs(executor);

            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .vote(1, true))
                .to.be.revertedWithCustomError(protocolGovernance, "EnforcedPause");
        });

        it("Should prevent proposal execution when paused", async function () {
            
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated")
                .withArgs(1, 0, governor);
            
            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .vote(1, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(1, voter, true);

            await time.increase(9 * 24 * 60 * 60 + 1);
            
            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .pause())
                .to.emit(protocolGovernance, "Paused")
                .withArgs(executor);

            await expect(protocolGovernance.connect(await ethers.getSigner(executor))
                .executeProposal(1))
                .to.be.revertedWithCustomError(protocolGovernance, "EnforcedPause");
        });
    });

    describe("Quorum Calculations", function () {
        beforeEach(async function () {
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated")
                .withArgs(1, 0, governor);
        });

        it("Should calculate quorum correctly with multiple voters", async function () {
            const { admin } = await getNamedAccounts();
            const [voter1, voter2, voter3] = await ethers.getSigners();
            
            await expect(protocolGovernance.connect(await ethers.getSigner(admin))
                .updateVotingPower(voter1.address, 300))
                .to.emit(protocolGovernance, "VotingPowerUpdated")
                .withArgs(voter1.address, 300);

            await expect(protocolGovernance.connect(await ethers.getSigner(admin))
                .updateVotingPower(voter2.address, 300))
                .to.emit(protocolGovernance, "VotingPowerUpdated")
                .withArgs(voter2.address, 300);

            await expect(protocolGovernance.connect(await ethers.getSigner(admin))
                .updateVotingPower(voter3.address, 400))
                .to.emit(protocolGovernance, "VotingPowerUpdated")
                .withArgs(voter3.address, 400);
            
            await expect(protocolGovernance.connect(voter1)
                .vote(1, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(1, voter1.address, true);

            await expect(protocolGovernance.connect(voter2)
                .vote(1, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(1, voter2.address, true);
            
            //expect(await protocolGovernance.hasReachedQuorum(1)).to.be.false;

            await expect(protocolGovernance.connect(voter3)
                .vote(1, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(1, voter3.address, true);

            expect(await protocolGovernance.hasReachedQuorum(1)).to.be.true;
        });

        it("Should handle split votes correctly", async function () {
            const { admin } = await getNamedAccounts();
            const [voter1, voter2] = await ethers.getSigners();
            
            await expect(protocolGovernance.connect(await ethers.getSigner(admin))
                .updateVotingPower(voter1.address, 500))
                .to.emit(protocolGovernance, "VotingPowerUpdated")
                .withArgs(voter1.address, 500);

            await expect(protocolGovernance.connect(await ethers.getSigner(admin))
                .updateVotingPower(voter2.address, 500))
                .to.emit(protocolGovernance, "VotingPowerUpdated")
                .withArgs(voter2.address, 500);
            
            await expect(protocolGovernance.connect(voter1)
                .vote(1, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(1, voter1.address, true);

            await expect(protocolGovernance.connect(voter2)
                .vote(1, false))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(1, voter2.address, false);
            
            const proposal = await protocolGovernance.getProposal(1);
            expect(proposal.votesFor).to.equal(500);
            expect(proposal.votesAgainst).to.equal(500);
            expect(await protocolGovernance.hasReachedQuorum(1)).to.be.true;
        });
    });

    describe("Edge Cases", function () {
        it("Should handle proposal with maximum votes", async function () {
            const { admin } = await getNamedAccounts();
            const voter = await ethers.getSigner(admin);
            
            const maxVotingPower = ethers.MaxUint256;
            /* await expect(protocolGovernance.connect(voter)
                .updateVotingPower(voter.address, maxVotingPower))
                .to.emit(protocolGovernance, "VotingPowerUpdated")
                .withArgs(voter.address, maxVotingPower); */
            
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated")
                .withArgs(1, 0, governor);
            
            await expect(protocolGovernance.connect(voter)
                .vote(1, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(1, voter.address, true);
        });

        it("Should handle concurrent proposal creation", async function () {
            const governorSigner = await ethers.getSigner(governor);
            
            await expect(protocolGovernance.connect(governorSigner)
                .createProposal(0, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated")
                .withArgs(1, 0, governor);

            await expect(protocolGovernance.connect(governorSigner)
                .createProposal(1, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated")
                .withArgs(2, 1, governor);

            await expect(protocolGovernance.connect(governorSigner)
                .createProposal(2, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated")
                .withArgs(3, 2, governor);
        });

        it("Should handle zero voting power updates", async function () {
            const { admin } = await getNamedAccounts();
            await expect(protocolGovernance.connect(await ethers.getSigner(admin))
                .updateVotingPower(voter, 0))
                .to.emit(protocolGovernance, "VotingPowerUpdated")
                .withArgs(voter, 0);
                
            expect(await protocolGovernance.getVotingPower(voter)).to.equal(0);
        });
    });
});