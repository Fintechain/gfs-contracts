// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
/**
 * @title IGovernance - Interface for on-chain governance
 * @notice This contract manages the governance process for the DFN
 */
interface IGovernance {
    /**
     * @notice Emitted when a new proposal is created
     * @param proposalId The unique identifier of the proposal
     * @param proposer The address of the account that created the proposal
     */
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer);

    /**
     * @notice Emitted when a vote is cast
     * @param proposalId The unique identifier of the proposal
     * @param voter The address of the voter
     * @param support Whether the vote is in support of the proposal
     */
    event Voted(uint256 indexed proposalId, address indexed voter, bool support);

    /**
     * @notice Emitted when a proposal is executed
     * @param proposalId The unique identifier of the executed proposal
     */
    event ProposalExecuted(uint256 indexed proposalId);

    /**
     * @notice Creates a new governance proposal
     * @param description A description of the proposal
     * @param data The call data of the proposal
     * @return uint256 The unique identifier of the created proposal
     */
    function createProposal(string memory description, bytes memory data) external returns (uint256);

    /**
     * @notice Casts a vote on a proposal
     * @param proposalId The unique identifier of the proposal
     * @param support Whether the vote is in support of the proposal
     */
    function vote(uint256 proposalId, bool support) external;

    /**
     * @notice Executes a proposal that has passed
     * @param proposalId The unique identifier of the proposal to execute
     */
    function executeProposal(uint256 proposalId) external;

    /**
     * @notice Retrieves the details of a proposal
     * @param proposalId The unique identifier of the proposal to query
     * @return proposer The address of the proposal creator
     * @return description The description of the proposal
     * @return forVotes The number of votes in support of the proposal
     * @return againstVotes The number of votes against the proposal
     * @return executed Whether the proposal has been executed
     */
    function getProposal(uint256 proposalId) external view returns (address proposer, string memory description, uint256 forVotes, uint256 againstVotes, bool executed);
}
