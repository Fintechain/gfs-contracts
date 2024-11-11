// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMessageRegistry
 * @notice Interface for the ISO20022 Message Registry that maintains
 * an immutable record of all messages processed through the system
 */
interface IMessageRegistry {
    /// @notice Structure defining an ISO20022 message
    struct ISO20022Message {
        bytes32 messageId;        // Unique message identifier
        bytes32 messageType;      // e.g., PACS.008, PACS.009
        bytes32 messageHash;      // Hash of original ISO20022 XML
        address sender;           // Original message sender
        address target;           // Intended recipient
        uint16 targetChain;      // Target chain ID if cross-chain
        uint256 timestamp;       // Message timestamp
        bytes payload;           // Encoded message data
        MessageStatus status;    // Current status
    }

    /// @notice Status tracking for messages
    enum MessageStatus {
        PENDING,    // Message registered but not processed
        DELIVERED,  // Message delivered to target
        PROCESSED,  // Message processed by target
        FAILED,     // Message processing failed
        SETTLED     // Message resulted in settlement
    }

    /// @notice Emitted when a new message is registered
    event MessageRegistered(
        bytes32 indexed messageId,
        bytes32 indexed messageType,
        address indexed sender,
        address target,
        uint16 targetChain
    );

    /// @notice Emitted when a message status changes
    event MessageStatusUpdated(
        bytes32 indexed messageId,
        MessageStatus oldStatus,
        MessageStatus newStatus
    );

    /**
     * @notice Register a new ISO20022 message
     * @param messageType Type of the ISO20022 message
     * @param messageHash Hash of the original message
     * @param target Target address
     * @param targetChain Target chain ID
     * @param payload Encoded message data
     * @return messageId Unique identifier for the registered message
     */
    function registerMessage(
        bytes32 messageType,
        bytes32 messageHash,
        address target,
        uint16 targetChain,
        bytes calldata payload
    ) external returns (bytes32 messageId);

    /**
     * @notice Update the status of a message
     * @param messageId ID of the message
     * @param newStatus New status to set
     */
    function updateMessageStatus(
        bytes32 messageId,
        MessageStatus newStatus
    ) external;

    /**
     * @notice Get message details by ID
     * @param messageId ID of the message to retrieve
     * @return message Message details
     */
    function getMessage(
        bytes32 messageId
    ) external view returns (ISO20022Message memory);

    /**
     * @notice Check if a message has been registered
     * @param messageId ID of the message to check
     * @return exists Whether the message exists
     */
    function messageExists(bytes32 messageId) external view returns (bool);

    /**
     * @notice Get the current status of a message
     * @param messageId ID of the message
     * @return status Current status of the message
     */
    function getMessageStatus(
        bytes32 messageId
    ) external view returns (MessageStatus);

    /**
     * @notice Get all messages for a specific sender
     * @param sender Address of the sender
     * @return messageIds Array of message IDs
     */
    function getMessagesBySender(
        address sender
    ) external view returns (bytes32[] memory);

    /**
     * @notice Get all messages for a specific target
     * @param target Target address
     * @return messageIds Array of message IDs
     */
    function getMessagesByTarget(
        address target
    ) external view returns (bytes32[] memory);
}