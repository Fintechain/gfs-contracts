// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IProtocolGovernance
 * @notice Interface for governing the ISO20022 messaging protocol
 */
interface IProtocolGovernance {
    /// @notice Types of governance proposals
    enum ProposalType {
        UPDATE_PROTOCOL,      // Protocol version/parameters
        ADD_MESSAGE_TYPE,     // New message format
        UPDATE_MESSAGE_TYPE,  // Existing message format
        ADD_TARGET,          // New target registration
        REMOVE_TARGET,       // Target removal
        EMERGENCY_ACTION     // Emergency protocol actions
    }

    /// @notice Governance proposal structure
    struct Proposal {
        uint256 id;
        ProposalType proposalType;
        address proposer;
        bytes data;
        uint256 timestamp;
        bool executed;
        uint256 votesFor;
        uint256 votesAgainst;
    }

    /// @notice Emitted when new proposal is created
    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType indexed proposalType,
        address indexed proposer
    );

    /// @notice Emitted when proposal is executed
    event ProposalExecuted(
        uint256 indexed proposalId,
        bool success
    );

    /// @notice Emitted when a vote is cast
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    
    /// @notice Emitted when emergency action is executed
    event EmergencyActionExecuted(bytes32 indexed actionHash);
    
    /// @notice Emitted when voting power is updated
    event VotingPowerUpdated(address indexed account, uint256 newPower);

    /// @notice Error for unauthorized access
    error NotAuthorized();

    /**
     * @notice Create a new governance proposal
     * @param proposalType Type of proposal
     * @param data Proposal data
     * @return proposalId Unique proposal identifier
     */
    function createProposal(
        ProposalType proposalType,
        bytes calldata data
    ) external returns (uint256);

    /**
     * @notice Vote on a proposal
     * @param proposalId Proposal identifier
     * @param support Whether to support the proposal
     */
    function vote(uint256 proposalId, bool support) external;

    /**
     * @notice Execute an approved proposal
     * @param proposalId Proposal identifier
     * @return success Whether execution was successful
     */
    function executeProposal(
        uint256 proposalId
    ) external returns (bool);

    /**
     * @notice Execute emergency action
     * @param action Emergency action data
     * @return success Whether action was successful
     */
    function executeEmergencyAction(
        bytes calldata action
    ) external returns (bool);

    /**
     * @notice Get proposal details
     * @param proposalId Proposal identifier
     * @return proposal Proposal details
     */
    function getProposal(
        uint256 proposalId
    ) external view returns (Proposal memory);

    /**
     * @notice Check if address has voted on proposal
     * @param proposalId Proposal identifier
     * @param voter Voter address
     * @return hasVoted Whether address has voted
     */
    function hasVoted(
        uint256 proposalId,
        address voter
    ) external view returns (bool);

    /**
     * @notice Get current voting power of an address
     * @param account Account to check
     * @return power Voting power
     */
    function getVotingPower(address account) external view returns (uint256);
}