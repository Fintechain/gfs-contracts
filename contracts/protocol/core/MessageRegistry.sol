// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../interfaces/IMessageRegistry.sol";

/**
 * @title MessageRegistry
 * @notice Implementation of the ISO20022 Message Registry for tracking and managing messages
 */
contract MessageRegistry is IMessageRegistry, AccessControl, Pausable, ReentrancyGuard {
    // Role definitions
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");
    
    // Storage
    mapping(bytes32 => ISO20022Message) private messages;
    mapping(address => bytes32[]) private senderMessages;
    mapping(address => bytes32[]) private targetMessages;
    mapping(bytes32 => bool) private processedMessages;

    // Events for tracking changes not in interface
    event MessageRemoved(bytes32 indexed messageId);
    event IndexCleared(address indexed account, bool isSender);
    
    /**
     * @notice Contract constructor
     * @dev Sets up initial roles
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
        _grantRole(PROCESSOR_ROLE, msg.sender);
    }

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
    ) external override whenNotPaused nonReentrant returns (bytes32) {
        require(
            hasRole(REGISTRAR_ROLE, msg.sender),
            "MessageRegistry: Must have registrar role"
        );
        require(target != address(0), "MessageRegistry: Invalid target address");
        require(payload.length > 0, "MessageRegistry: Empty payload");

        bytes32 messageId = generateMessageId(
            messageType,
            messageHash,
            msg.sender,
            target,
            targetChain
        );

        require(!messageExists(messageId), "MessageRegistry: Message already exists");

        // Create and store message
        messages[messageId] = ISO20022Message({
            messageId: messageId,
            messageType: messageType,
            messageHash: messageHash,
            sender: msg.sender,
            target: target,
            targetChain: targetChain,
            timestamp: block.timestamp,
            payload: payload,
            status: MessageStatus.PENDING
        });

        // Update indices
        senderMessages[msg.sender].push(messageId);
        targetMessages[target].push(messageId);

        emit MessageRegistered(
            messageId,
            messageType,
            msg.sender,
            target,
            targetChain
        );

        return messageId;
    }

    /**
     * @notice Update the status of a message
     * @param messageId ID of the message
     * @param newStatus New status to set
     */
    function updateMessageStatus(
        bytes32 messageId,
        MessageStatus newStatus
    ) external override whenNotPaused {
        require(
            hasRole(PROCESSOR_ROLE, msg.sender),
            "MessageRegistry: Must have processor role"
        );
        require(messageExists(messageId), "MessageRegistry: Message not found");

        ISO20022Message storage message = messages[messageId];
        MessageStatus oldStatus = message.status;
        
        require(
            isValidStatusTransition(oldStatus, newStatus),
            "MessageRegistry: Invalid status transition"
        );

        message.status = newStatus;
        
        if (newStatus == MessageStatus.PROCESSED || 
            newStatus == MessageStatus.SETTLED) {
            processedMessages[messageId] = true;
        }

        emit MessageStatusUpdated(messageId, oldStatus, newStatus);
    }

    /**
     * @notice Get message details by ID
     * @param messageId ID of the message to retrieve
     * @return message Message details
     */
    function getMessage(
        bytes32 messageId
    ) external view override returns (ISO20022Message memory) {
        require(messageExists(messageId), "MessageRegistry: Message not found");
        return messages[messageId];
    }

    /**
     * @notice Check if a message has been registered
     * @param messageId ID of the message to check
     * @return exists Whether the message exists
     */
    function messageExists(
        bytes32 messageId
    ) public view override returns (bool) {
        return messages[messageId].messageId == messageId;
    }

    /**
     * @notice Get the current status of a message
     * @param messageId ID of the message
     * @return status Current status of the message
     */
    function getMessageStatus(
        bytes32 messageId
    ) external view override returns (MessageStatus) {
        require(messageExists(messageId), "MessageRegistry: Message not found");
        return messages[messageId].status;
    }

    /**
     * @notice Get all messages for a specific sender
     * @param sender Address of the sender
     * @return messageIds Array of message IDs
     */
    function getMessagesBySender(
        address sender
    ) external view override returns (bytes32[] memory) {
        return senderMessages[sender];
    }

    /**
     * @notice Get all messages for a specific target
     * @param target Target address
     * @return messageIds Array of message IDs
     */
    function getMessagesByTarget(
        address target
    ) external view override returns (bytes32[] memory) {
        return targetMessages[target];
    }

    /**
     * @notice Generate a unique message ID
     * @param messageType Type of message
     * @param messageHash Original message hash
     * @param sender Sender address
     * @param target Target address
     * @param targetChain Target chain ID
     * @return messageId Generated message ID
     */
    function generateMessageId(
        bytes32 messageType,
        bytes32 messageHash,
        address sender,
        address target,
        uint16 targetChain
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                messageType,
                messageHash,
                sender,
                target,
                targetChain
            )
        );
    }

    /**
     * @notice Check if a message has been processed
     * @param messageId Message ID to check
     * @return isProcessed Whether message is processed
     */
    function isMessageProcessed(bytes32 messageId) external view returns (bool) {
        return processedMessages[messageId];
    }

    /**
     * @notice Validate status transition
     * @param oldStatus Current status
     * @param newStatus Proposed new status
     * @return isValid Whether transition is valid
     */
    function isValidStatusTransition(
        MessageStatus oldStatus,
        MessageStatus newStatus
    ) internal pure returns (bool) {
        if (oldStatus == MessageStatus.PENDING) {
            return newStatus == MessageStatus.DELIVERED || 
                   newStatus == MessageStatus.FAILED;
        }
        if (oldStatus == MessageStatus.DELIVERED) {
            return newStatus == MessageStatus.PROCESSED || 
                   newStatus == MessageStatus.FAILED;
        }
        if (oldStatus == MessageStatus.PROCESSED) {
            return newStatus == MessageStatus.SETTLED;
        }
        return false;
    }

    /**
     * @notice Clear sender or target message index
     * @param account Account to clear
     * @param isSender Whether to clear sender or target index
     */
    function clearMessageIndex(
        address account,
        bool isSender
    ) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "MessageRegistry: Must have admin role"
        );

        if (isSender) {
            delete senderMessages[account];
        } else {
            delete targetMessages[account];
        }

        emit IndexCleared(account, isSender);
    }

    /**
     * @notice Pause the registry
     */
    function pause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "MessageRegistry: Must have admin role"
        );
        _pause();
    }

    /**
     * @notice Unpause the registry
     */
    function unpause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "MessageRegistry: Must have admin role"
        );
        _unpause();
    }
}