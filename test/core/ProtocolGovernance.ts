import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ProtocolGovernance } from "../../typechain";

describe("ProtocolGovernance", function () {
    let protocolGovernance: ProtocolGovernance;
    const testProposalData = ethers.toUtf8Bytes("test-proposal");

    beforeEach(async function () {
        await deployments.fixture(['ProtocolGovernance']);

        const { admin, governor, executor, voter } = await getNamedAccounts();

        const ProtocolGovernanceDeployment = await deployments.get('ProtocolGovernance');
        protocolGovernance = await ethers.getContractAt('ProtocolGovernance', ProtocolGovernanceDeployment.address);

        // Grant roles
        const governorRole = await protocolGovernance.GOVERNOR_ROLE();
        const executorRole = await protocolGovernance.EXECUTOR_ROLE();
        const emergencyRole = await protocolGovernance.EMERGENCY_ROLE();

        await protocolGovernance.connect(await ethers.getSigner(admin)).grantRole(governorRole, governor);
        await protocolGovernance.connect(await ethers.getSigner(admin)).grantRole(executorRole, executor);
        
        // Set up voting power
        await protocolGovernance.connect(await ethers.getSigner(admin)).updateVotingPower(voter, 100);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await protocolGovernance.hasRole(await protocolGovernance.DEFAULT_ADMIN_ROLE(), admin)).to.be.true;
        });

        it("Should set initial voting power for admin", async function () {
            const { admin } = await getNamedAccounts();
            expect(await protocolGovernance.getVotingPower(admin)).to.equal(100);
        });
    });

    describe("Proposal Creation", function () {
        it("Should allow governor to create proposal", async function () {
            const { governor } = await getNamedAccounts();
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, testProposalData))
                .to.emit(protocolGovernance, "ProposalCreated");
        });

        it("Should revert if non-governor tries to create proposal", async function () {
            const { voter } = await getNamedAccounts();
            await expect(protocolGovernance.connect(await ethers.getSigner(voter))
                .createProposal(0, testProposalData))
                .to.be.revertedWith("ProtocolGovernance: Must have governor role");
        });

        it("Should revert with empty proposal data", async function () {
            const { governor } = await getNamedAccounts();
            await expect(protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, []))
                .to.be.revertedWith("ProtocolGovernance: Empty proposal data");
        });
    });

    describe("Voting", function () {
        let proposalId: number;

        beforeEach(async function () {
            const { governor } = await getNamedAccounts();
            const tx = await protocolGovernance.connect(await ethers.getSigner(governor))
                .createProposal(0, testProposalData);
            const receipt = await tx.wait();
            const event = receipt.events?.find(e => e.event === "ProposalCreated");
            proposalId = event?.args?.proposalId;
        });

        it("Should allow voter to vote", async function () {
            const { voter } = await getNamedAccounts();
            await expect(protocolGovernance.connect(await ethers.getSigner(voter)).vote(proposalId, true))
                .to.emit(protocolGovernance, "VoteCast")
                .withArgs(proposalId, voter, true);
        });

        it("Should revert if voter has no voting power", async function () {
            const { executor } = await getNamedAccounts();
            await expect(protocolGovernance.connect(await ethers.getSigner(executor)).vote(proposalId, true))
                .to.be.revertedWith("ProtocolGovernance: No voting power");
        });

        it("Should revert on duplicate vote", async function () {
            const { voter } = await getNamedAccounts();
            await protocolGovernance.connect(await ethers.getSigner(voter)).vote(proposalId, true);
            await expect(protocolGovernance.connect(await ethers.getSigner(voter)).vote(proposalId, true))
                .to.be.re