// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMessageProcessor
 * @notice Interface for processing different types of ISO20022 messages
 * and executing their corresponding business logic
 */
interface IMessageProcessor {
    /// @notice Type of processing action required
    enum ProcessingAction {
        NOTIFICATION_ONLY,    // Just notify target
        SETTLEMENT_REQUIRED,  // Requires settlement
        CROSS_CHAIN_ACTION,   // Requires cross-chain execution
        STATUS_UPDATE,        // Status update only
        CANCELLATION         // Cancel previous message
    }

    /// @notice Result of message processing
    struct ProcessingResult {
        bytes32 messageId;
        ProcessingAction action;
        bool success;
        bytes result;
        bytes32 settlementId;  // If settlement required
    }

    /// @notice Emitted when message processing begins
    event ProcessingStarted(
        bytes32 indexed messageId,
        bytes32 indexed messageType,
        ProcessingAction action
    );

    /// @notice Emitted when message processing completes
    event ProcessingCompleted(
        bytes32 indexed messageId,
        bool success,
        bytes32 settlementId
    );

    /**
     * @notice Process an ISO20022 message
     * @param messageId Unique message identifier
     * @param messageType Type of ISO20022 message
     * @param payload Message payload
     * @return result Processing result
     */
    function processMessage(
        bytes32 messageId,
        bytes32 messageType,
        bytes calldata payload
    ) external returns (ProcessingResult memory);

    /**
     * @notice Register a message handler for a specific message type
     * @param messageType Type of message
     * @param handler Address of handler contract
     */
    function registerMessageHandler(
        bytes32 messageType,
        address handler
    ) external;

    /**
     * @notice Get the processing status for a message
     * @param messageId Message identifier
     * @return status Current processing status
     */
    function getProcessingStatus(
        bytes32 messageId
    ) external view returns (ProcessingResult memory);

    /**
     * @notice Check if a message type has a registered handler
     * @param messageType Type of message
     * @return hasHandler Whether handler exists
     */
    function hasHandler(bytes32 messageType) external view returns (bool);

    /**
     * @notice Get the required action for a message type
     * @param messageType Type of message
     * @return action Required processing action
     */
    function getRequiredAction(
        bytes32 messageType
    ) external view returns (ProcessingAction);
}