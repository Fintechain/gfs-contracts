// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../interfaces/IProtocolGovernance.sol";

/**
 * @title ProtocolGovernance
 * @notice Implementation of protocol governance with voting and proposal execution
 */
contract ProtocolGovernance is IProtocolGovernance, AccessControl, Pausable, ReentrancyGuard {
    // Role definitions
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // Governance parameters
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant EXECUTION_DELAY = 2 days;
    uint256 public constant EMERGENCY_DELAY = 1 days;
    uint256 public constant QUORUM_PERCENTAGE = 51;

    // Storage
    mapping(uint256 => Proposal) private proposals;
    mapping(uint256 => mapping(address => bool)) private votes;
    mapping(address => uint256) private votingPower;
    mapping(bytes32 => bool) private executedProposals;
    
    uint256 private proposalCount;
    uint256 private totalVotingPower;

    // Events
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    event EmergencyActionExecuted(bytes32 indexed actionHash);
    event VotingPowerUpdated(address indexed account, uint256 newPower);

    /**
     * @notice Contract constructor
     * @dev Sets up initial roles and voting power
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNOR_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        
        // Set initial voting power for admin
        _updateVotingPower(msg.sender, 100);
    }

    /**
     * @notice Create a new governance proposal
     * @param proposalType Type of proposal
     * @param data Proposal data
     * @return proposalId Unique proposal identifier
     */
    function createProposal(
        ProposalType proposalType,
        bytes calldata data
    ) external override whenNotPaused nonReentrant returns (uint256) {
        require(
            hasRole(GOVERNOR_ROLE, msg.sender),
            "ProtocolGovernance: Must have governor role"
        );
        require(data.length > 0, "ProtocolGovernance: Empty proposal data");

        proposalCount++;
        uint256 proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposalType: proposalType,
            proposer: msg.sender,
            data: data,
            timestamp: block.timestamp,
            executed: false,
            votesFor: 0,
            votesAgainst: 0
        });

        emit ProposalCreated(proposalId, proposalType, msg.sender);
        return proposalId;
    }

    /**
     * @notice Vote on a proposal
     * @param proposalId Proposal identifier
     * @param support Whether to support the proposal
     */
    function vote(
        uint256 proposalId,
        bool support
    ) external override whenNotPaused nonReentrant {
        require(
            votingPower[msg.sender] > 0,
            "ProtocolGovernance: No voting power"
        );
        require(
            !hasVoted(proposalId, msg.sender),
            "ProtocolGovernance: Already voted"
        );
        require(
            !isProposalExpired(proposalId),
            "ProtocolGovernance: Voting period ended"
        );

        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "ProtocolGovernance: Proposal doesn't exist");
        require(!proposal.executed, "ProtocolGovernance: Already executed");

        votes[proposalId][msg.sender] = true;

        if (support) {
            proposal.votesFor += votingPower[msg.sender];
        } else {
            proposal.votesAgainst += votingPower[msg.sender];
        }

        emit VoteCast(proposalId, msg.sender, support);
    }

    /**
     * @notice Execute an approved proposal
     * @param proposalId Proposal identifier
     * @return success Whether execution was successful
     */
    function executeProposal(
        uint256 proposalId
    ) external override whenNotPaused nonReentrant returns (bool) {
        require(
            hasRole(EXECUTOR_ROLE, msg.sender),
            "ProtocolGovernance: Must have executor role"
        );
        
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "ProtocolGovernance: Proposal doesn't exist");
        require(!proposal.executed, "ProtocolGovernance: Already executed");
        require(
            isProposalExpired(proposalId),
            "ProtocolGovernance: Voting period not ended"
        );
        require(
            hasReachedQuorum(proposalId),
            "ProtocolGovernance: Quorum not reached"
        );
        require(
            hasPassedExecutionDelay(proposalId),
            "ProtocolGovernance: Execution delay not passed"
        );

        bytes32 proposalHash = keccak256(proposal.data);
        require(
            !executedProposals[proposalHash],
            "ProtocolGovernance: Duplicate proposal"
        );

        proposal.executed = true;
        executedProposals[proposalHash] = true;

        emit ProposalExecuted(proposalId, true);
        return true;
    }

    /**
     * @notice Execute emergency action
     * @param action Emergency action data
     * @return success Whether action was successful
     */
    function executeEmergencyAction(
        bytes calldata action
    ) external override whenNotPaused nonReentrant returns (bool) {
        require(
            hasRole(EMERGENCY_ROLE, msg.sender),
            "ProtocolGovernance: Must have emergency role"
        );
        require(action.length > 0, "ProtocolGovernance: Empty action data");

        bytes32 actionHash = keccak256(action);
        require(
            !executedProposals[actionHash],
            "ProtocolGovernance: Action already executed"
        );

        executedProposals[actionHash] = true;
        emit EmergencyActionExecuted(actionHash);
        return true;
    }

    /**
     * @notice Get proposal details
     * @param proposalId Proposal identifier
     * @return proposal Proposal details
     */
    function getProposal(
        uint256 proposalId
    ) external view override returns (Proposal memory) {
        return proposals[proposalId];
    }

    /**
     * @notice Check if address has voted on proposal
     * @param proposalId Proposal identifier
     * @param voter Voter address
     * @return hasVoted Whether address has voted
     */
    function hasVoted(
        uint256 proposalId,
        address voter
    ) public view override returns (bool) {
        return votes[proposalId][voter];
    }

    /**
     * @notice Get current voting power of an address
     * @param account Account to check
     * @return power Voting power
     */
    function getVotingPower(
        address account
    ) external view override returns (uint256) {
        return votingPower[account];
    }

    /**
     * @notice Update voting power for an account
     * @param account Account to update
     * @param power New voting power
     */
    function updateVotingPower(
        address account,
        uint256 power
    ) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "ProtocolGovernance: Must have admin role"
        );
        _updateVotingPower(account, power);
    }

    /**
     * @notice Internal function to update voting power
     * @param account Account to update
     * @param power New voting power
     */
    function _updateVotingPower(address account, uint256 power) private {
        totalVotingPower = totalVotingPower - votingPower[account] + power;
        votingPower[account] = power;
        emit VotingPowerUpdated(account, power);
    }

    /**
     * @notice Check if proposal voting period has expired
     * @param proposalId Proposal identifier
     * @return expired Whether voting period has expired
     */
    function isProposalExpired(uint256 proposalId) public view returns (bool) {
        return block.timestamp > proposals[proposalId].timestamp + VOTING_PERIOD;
    }

    /**
     * @notice Check if proposal has reached quorum
     * @param proposalId Proposal identifier
     * @return reached Whether quorum has been reached
     */
    function hasReachedQuorum(uint256 proposalId) public view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        return (totalVotes * 100) / totalVotingPower >= QUORUM_PERCENTAGE;
    }

    /**
     * @notice Check if execution delay has passed
     * @param proposalId Proposal identifier
     * @return passed Whether execution delay has passed
     */
    function hasPassedExecutionDelay(uint256 proposalId) public view returns (bool) {
        return block.timestamp > proposals[proposalId].timestamp + VOTING_PERIOD + EXECUTION_DELAY;
    }

    /**
     * @notice Pause protocol governance
     */
    function pause() external {
        require(
            hasRole(EMERGENCY_ROLE, msg.sender),
            "ProtocolGovernance: Must have emergency role"
        );
        _pause();
    }

    /**
     * @notice Unpause protocol governance
     */
    function unpause() external {
        require(
            hasRole(EMERGENCY_ROLE, msg.sender),
            "ProtocolGovernance: Must have emergency role"
        );
        _unpause();
    }
}