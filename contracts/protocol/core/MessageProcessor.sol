// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../interfaces/IMessageProcessor.sol";

/**
 * @title MessageProcessor
 * @notice Processes ISO20022 messages and executes corresponding actions
 */
contract MessageProcessor is IMessageProcessor, AccessControl, Pausable, ReentrancyGuard {
    // Role definitions
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");
    bytes32 public constant HANDLER_ADMIN_ROLE = keccak256("HANDLER_ADMIN_ROLE");

    // Storage
    mapping(bytes32 => address) private messageHandlers;
    mapping(bytes32 => ProcessingAction) private messageTypeActions;
    mapping(bytes32 => ProcessingResult) private processingResults;

    /**
     * @notice Contract constructor
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROCESSOR_ROLE, msg.sender);
        _grantRole(HANDLER_ADMIN_ROLE, msg.sender);
    }

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
    ) external override whenNotPaused nonReentrant returns (ProcessingResult memory) {
        require(
            hasRole(PROCESSOR_ROLE, msg.sender),
            "MessageProcessor: Must have processor role"
        );
        require(
            hasHandler(messageType),
            "MessageProcessor: No handler for message type"
        );
        require(
            processingResults[messageId].messageId == bytes32(0),
            "MessageProcessor: Message already processed"
        );

        address handler = messageHandlers[messageType];
        ProcessingAction action = messageTypeActions[messageType];

        emit ProcessingStarted(messageId, messageType, action);

        // Call handler and capture any revert
        bool success;
        bytes memory result;
        bytes32 settlementId;

        (success, result) = handler.call(
            abi.encodeWithSignature(
                "handleMessage(bytes32,bytes)",
                messageId,
                payload
            )
        );

        // If settlement required, extract settlement ID from result
        if (success && action == ProcessingAction.SETTLEMENT_REQUIRED) {
            settlementId = abi.decode(result, (bytes32));
        }

        // Store result
        ProcessingResult memory processingResult = ProcessingResult({
            messageId: messageId,
            action: action,
            success: success,
            result: result,
            settlementId: settlementId
        });

        processingResults[messageId] = processingResult;

        emit ProcessingCompleted(messageId, success, settlementId);

        return processingResult;
    }

    /**
     * @notice Register a message handler for a specific message type
     * @param messageType Type of message
     * @param handler Address of handler contract
     */
    function registerMessageHandler(
        bytes32 messageType,
        address handler
    ) external override {
        require(
            hasRole(HANDLER_ADMIN_ROLE, msg.sender),
            "MessageProcessor: Must have handler admin role"
        );
        require(handler != address(0), "MessageProcessor: Invalid handler address");
        require(
            messageHandlers[messageType] == address(0),
            "MessageProcessor: Handler already registered"
        );

        messageHandlers[messageType] = handler;
        emit HandlerRegistered(messageType, handler, msg.sender);
    }

    /**
     * @notice Set required action for message type
     * @param messageType Message type
     * @param action Required action
     */
    function setRequiredAction(
        bytes32 messageType,
        ProcessingAction action
    ) external {
        require(
            hasRole(HANDLER_ADMIN_ROLE, msg.sender),
            "MessageProcessor: Must have handler admin role"
        );
        messageTypeActions[messageType] = action;
    }

    /**
     * @notice Get the processing status for a message
     * @param messageId Message identifier
     * @return status Current processing status
     */
    function getProcessingStatus(
        bytes32 messageId
    ) external view override returns (ProcessingResult memory) {
        return processingResults[messageId];
    }

    /**
     * @notice Check if a message type has a registered handler
     * @param messageType Type of message
     * @return hasHandler Whether handler exists
     */
    function hasHandler(
        bytes32 messageType
    ) public view override returns (bool) {
        return messageHandlers[messageType] != address(0);
    }

    /**
     * @notice Get the required action for a message type
     * @param messageType Type of message
     * @return action Required processing action
     */
    function getRequiredAction(
        bytes32 messageType
    ) external view override returns (ProcessingAction) {
        return messageTypeActions[messageType];
    }

    /**
     * @notice Get handler address for message type
     * @param messageType Message type
     * @return handler Handler address
     */
    function getHandler(
        bytes32 messageType
    ) external view returns (address) {
        return messageHandlers[messageType];
    }

    /**
     * @notice Pause the processor
     */
    function pause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "MessageProcessor: Must have admin role"
        );
        _pause();
    }

    /**
     * @notice Unpause the processor
     */
    function unpause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "MessageProcessor: Must have admin role"
        );
        _unpause();
    }
}