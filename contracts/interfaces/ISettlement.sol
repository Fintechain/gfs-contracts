// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * @title ISettlement - Interface for settlement operations
 * @notice This contract manages the settlement process for financial transactions
 */
interface ISettlement {
    /**
     * @notice Emitted when a settlement is initiated
     * @param settlementId The unique identifier of the settlement
     * @param initiator The address of the settlement initiator
     * @param amount The total amount involved in the settlement
     */
    event SettlementInitiated(bytes32 indexed settlementId, address indexed initiator, uint256 amount);

    /**
     * @notice Emitted when a settlement is completed
     * @param settlementId The unique identifier of the completed settlement
     */
    event SettlementCompleted(bytes32 indexed settlementId);

    /**
     * @notice Initiates a new settlement
     * @param parties The addresses of parties involved in the settlement
     * @param tokens The addresses of tokens involved in the settlement
     * @param amounts The amounts of each token to be settled
     * @return bytes32 The unique identifier of the initiated settlement
     */
    function initiateSettlement(address[] memory parties, address[] memory tokens, uint256[] memory amounts) external returns (bytes32);

    /**
     * @notice Confirms a settlement
     * @param settlementId The unique identifier of the settlement to confirm
     */
    function confirmSettlement(bytes32 settlementId) external;

    /**
     * @notice Retrieves the status of a settlement
     * @param settlementId The unique identifier of the settlement to query
     * @return completed Whether the settlement is completed
     * @return confirmations The number of confirmations received for the settlement
     */
    function getSettlementStatus(bytes32 settlementId) external view returns (bool completed, uint256 confirmations);
}