// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ISettlementController
 * @notice Interface for processing settlement instructions from message handlers
 */
interface ISettlementController {
    /// @notice Status of a settlement
    enum SettlementStatus {
        NONE,
        IN_PROGRESS,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    /// @notice Settlement details
    struct Settlement {
        bytes32 settlementId;      // Unique settlement identifier
        bytes32 messageId;         // Associated message ID
        address token;            // Token being settled
        uint256 amount;           // Settlement amount
        address sender;           // Original settlement initiator
        address recipient;        // Settlement recipient
        SettlementStatus status;  // Current status
        uint256 timestamp;        // Settlement timestamp
    }

    /// @notice Emitted when settlement is processed
    event SettlementProcessed(
        bytes32 indexed settlementId,
        bytes32 indexed messageId,
        uint256 amount,
        address recipient
    );

    /// @notice Emitted when settlement status changes
    event SettlementStatusUpdated(
        bytes32 indexed settlementId,
        SettlementStatus status
    );

    /**
     * @notice Process a settlement instruction
     * @param messageId Associated message ID
     * @param token Token address
     * @param amount Amount to settle
     * @param recipient Recipient address
     * @return settlementId Generated settlement ID
     */
    function processSettlement(
        bytes32 messageId,
        address token,
        uint256 amount,
        address recipient
    ) external returns (bytes32 settlementId);

    /**
     * @notice Get settlement details
     * @param settlementId Settlement identifier
     * @return Settlement details
     */
    function getSettlement(
        bytes32 settlementId
    ) external view returns (Settlement memory);

    /**
     * @notice Get settlements associated with a message
     * @param messageId Message identifier
     * @return Settlement IDs associated with message
     */
    function getSettlementsByMessage(
        bytes32 messageId
    ) external view returns (bytes32[] memory);
}