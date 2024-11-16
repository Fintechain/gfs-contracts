// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IProtocolCoordinator
 * @notice Main entry point and orchestration interface for the GFS Protocol
 * @dev Coordinates interactions between MessageRegistry, MessageRouter, MessageProcessor,
 *      SettlementController, and other protocol components
 */
interface IProtocolCoordinator {
    /**
     * @notice Struct to hold message submission parameters
     * @param messageType Type of ISO20022 message (e.g., PACS.008)
     * @param target Destination address for the message
     * @param targetChain Chain ID where the target is located
     * @param payload Encoded ISO20022 message data
     * @param settlementData Optional settlement information if value transfer is required
     */
    struct MessageSubmission {
        bytes32 messageType;
        address target;
        uint16 targetChain;
        bytes payload;
        SettlementInfo settlementData;
    }

    /**
     * @notice Struct to hold settlement-related information
     * @param sourceToken Token address on source chain
     * @param targetToken Token address on target chain
     * @param amount Amount to be settled
     * @param recipient Recipient address for settlement
     */
    struct SettlementInfo {
        address sourceToken;
        address targetToken;
        uint256 amount;
        address recipient;
    }

    /**
     * @notice Event emitted when a message submission is initiated
     * @param messageId Unique identifier for the message
     * @param sender Address that submitted the message
     * @param messageType Type of ISO20022 message
     * @param target Destination address
     * @param targetChain Destination chain ID
     */
    event MessageSubmissionInitiated(
        bytes32 indexed messageId,
        address indexed sender,
        bytes32 indexed messageType,
        address target,
        uint16 targetChain
    );

    /**
     * @notice Event emitted when message processing is completed
     * @param messageId Unique identifier for the message
     * @param status Final status of the message
     * @param settlementId Associated settlement ID if applicable
     */
    event MessageProcessingCompleted(
        bytes32 indexed messageId,
        uint8 status,
        bytes32 indexed settlementId
    );

    /**
     * @notice Submit a new ISO20022 message to the protocol
     * @dev Main entry point for message submission. Handles validation, routing, and settlement initiation
     * @param submission MessageSubmission struct containing all message details
     * @return messageId Unique identifier for tracking the message
     */
    function submitMessage(
        MessageSubmission calldata submission
    ) external payable returns (bytes32 messageId);

    /**
     * @notice Quote the total fee required for message submission
     * @dev Calculates all required fees including routing, processing, and settlement if needed
     * @param submission MessageSubmission struct containing message details
     * @return baseFee Base protocol fee
     * @return deliveryFee Fee for message delivery
     * @return settlementFee Fee for settlement if required
     */
    function quoteMessageFee(
        MessageSubmission calldata submission
    ) external view returns (
        uint256 baseFee,
        uint256 deliveryFee,
        uint256 settlementFee
    );

    /**
     * @notice Get the current status of a submitted message
     * @dev Returns comprehensive status including routing and settlement status if applicable
     * @param messageId ID of the message to query
     * @return processingStatus Current message processing status
     * @return settlementId Associated settlement ID if exists
     * @return settlementStatus Current settlement status if exists
     */
    function getMessageStatus(
        bytes32 messageId
    ) external view returns (
        uint8 processingStatus,
        bytes32 settlementId,
        uint8 settlementStatus
    );

    /**
     * @notice Retry a failed message processing
     * @dev Allows retrying messages that failed in processing or delivery
     * @param messageId ID of the message to retry
     * @return success Whether retry was successfully initiated
     */
    function retryMessage(
        bytes32 messageId
    ) external payable returns (bool success);

    /**
     * @notice Cancel a pending message that hasn't been processed
     * @dev Only allowed for messages in specific states and by original sender
     * @param messageId ID of the message to cancel
     * @return success Whether cancellation was successful
     */
    function cancelMessage(
        bytes32 messageId
    ) external returns (bool success);

    /**
     * @notice Update protocol dependencies
     * @dev Admin function to update addresses of protocol components
     * @param component Name or identifier of the component to update
     * @param newAddress New contract address for the component
     */
    function updateProtocolComponent(
        bytes32 component,
        address newAddress
    ) external;

    /**
     * @notice Execute emergency message cancellation
     * @dev Only callable by emergency admin role
     * @param messageId ID of the message to force cancel
     * @return success Whether emergency cancellation was successful
     */
    function emergencyCancelMessage(
        bytes32 messageId
    ) external returns (bool success);

    /**
     * @notice Check if a message requires settlement
     * @dev Analyzes message type and content to determine settlement requirement
     * @param messageType Type of ISO20022 message
     * @param payload Encoded message data
     * @return requiresSettlement Whether settlement is required
     */
    function messageRequiresSettlement(
        bytes32 messageType,
        bytes calldata payload
    ) external view returns (bool requiresSettlement);

    /**
     * @notice Get detailed processing result for a message
     * @dev Returns comprehensive information about message processing outcome
     * @param messageId ID of the message to query
     * @return success Whether processing was successful
     * @return result Detailed processing result data
     * @return settlementData Settlement information if applicable
     */
    function getMessageResult(
        bytes32 messageId
    ) external view returns (
        bool success,
        bytes memory result,
        bytes memory settlementData
    );

    /**
     * @notice Returns active protocol configuration
     * @dev Retrieves current settings for fees, timeouts, and other parameters
     * @return config Encoded configuration data
     */
    function getProtocolConfig() external view returns (bytes memory config);
}