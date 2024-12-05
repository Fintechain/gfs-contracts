// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../interfaces/IProtocolCoordinator.sol";
import "../../interfaces/IMessageRegistry.sol";
import "../../interfaces/IMessageProtocol.sol";
import "../../interfaces/IMessageRouter.sol";
import "../../interfaces/IMessageProcessor.sol";

/**
 * @title ProtocolCoordinator
 * @notice Main orchestration contract for the GFS Protocol
 * @dev Coordinates message submission, routing, and processing
 */
contract ProtocolCoordinator is
    IProtocolCoordinator,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // Protocol components
    IMessageRegistry public messageRegistry;
    IMessageProtocol public messageProtocol;
    IMessageRouter public messageRouter;
    IMessageProcessor public messageProcessor;

    // Protocol configuration
    uint256 public baseFee;
    uint256 public constant MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB

    // Message tracking
    mapping(bytes32 => MessageSubmission) private submissions;
    mapping(bytes32 => address) private messageSenders;

    // Events
    event ComponentUpdated(
        bytes32 indexed component,
        address indexed newAddress
    );
    event FeeUpdated(uint256 newBaseFee);
    event MessageRetryInitiated(bytes32 indexed messageId);

    constructor(
        address _registry,
        address _protocol,
        address _router,
        address _processor
    ) {
        require(_registry != address(0), "Invalid registry address");
        require(_protocol != address(0), "Invalid protocol address");
        require(_router != address(0), "Invalid router address");
        require(_processor != address(0), "Invalid processor address");

        messageRegistry = IMessageRegistry(_registry);
        messageProtocol = IMessageProtocol(_protocol);
        messageRouter = IMessageRouter(_router);
        messageProcessor = IMessageProcessor(_processor);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);

        baseFee = 0.001 ether; // Initial base fee
    }

    function submitMessage(
        MessageSubmission calldata submission
    ) external payable override whenNotPaused nonReentrant returns (bytes32) {
        // Validate submission
        require(submission.payload.length > 0, "Empty payload");
        require(
            submission.payload.length <= MAX_MESSAGE_SIZE,
            "Payload too large"
        );
        require(submission.target != address(0), "Invalid target");

        // Calculate and verify fees
        (uint256 _baseFee, uint256 _deliveryFee) = quoteMessageFee(submission);
        require(msg.value >= _baseFee + _deliveryFee, "Insufficient fee");

        // Validate message format
        require(
            messageProtocol.validateMessage(
                submission.messageType,
                submission.payload
            ),
            "Invalid message format"
        );

        // Generate message hash
        bytes32 messageHash = keccak256(submission.payload);

        // Register message
        bytes32 messageId = messageRegistry.registerMessage(
            submission.messageType,
            messageHash,
            submission.target,
            submission.targetChain,
            submission.payload
        );

        // Store submission details
        submissions[messageId] = submission;
        messageSenders[messageId] = msg.sender;

        // Route message
        messageRouter.routeMessage{value: _deliveryFee}(
            messageId,
            submission.target,
            submission.targetChain,
            submission.payload
        );

        // For local messages (targetChain == 1), mark as processed immediately
        if (submission.targetChain == 1) {
            messageRegistry.updateMessageStatus(
                messageId,
                IMessageRegistry.MessageStatus.DELIVERED
            );

            messageRegistry.updateMessageStatus(
                messageId,
                IMessageRegistry.MessageStatus.PROCESSED
            );
        }

        emit MessageSubmissionInitiated(
            messageId,
            msg.sender,
            submission.messageType,
            submission.target,
            submission.targetChain
        );

        return messageId;
    }

    function quoteMessageFee(
        MessageSubmission calldata submission
    ) public view override returns (uint256 _baseFee, uint256 _deliveryFee) {
        require(
            address(messageRouter) != address(0),
            "MessageRouter not initialized"
        );
        require(submission.targetChain > 0, "Invalid chain ID");
        require(submission.payload.length > 0, "Empty payload");
        
        _baseFee = baseFee;
        _deliveryFee = messageRouter.quoteRoutingFee(
            submission.targetChain,
            submission.payload.length
        );
        return (_baseFee, _deliveryFee);
    }

    function getMessageResult(
        bytes32 messageId
    ) external view override returns (bool success, bytes memory result) {
        require(messageExists(messageId), "Message not found");

        IMessageProcessor.ProcessingResult memory procResult = messageProcessor
            .getProcessingStatus(messageId);

        return (procResult.success, procResult.result);
    }

    function retryMessage(
        bytes32 messageId
    ) external payable override whenNotPaused nonReentrant returns (bool) {
        require(messageExists(messageId), "Message not found");
        require(messageSenders[messageId] == msg.sender, "Not message sender");

        MessageSubmission memory submission = submissions[messageId];
        uint256 _deliveryFee = messageRouter.quoteRoutingFee(
            submission.targetChain,
            submission.payload.length
        );

        require(msg.value >= _deliveryFee, "Insufficient fee");

        messageRouter.routeMessage{value: _deliveryFee}(
            messageId,
            submission.target,
            submission.targetChain,
            submission.payload
        );

        emit MessageRetryInitiated(messageId);
        return true;
    }

    function cancelMessage(bytes32 messageId) external override returns (bool) {
        require(messageExists(messageId), "Message not found");
        require(messageSenders[messageId] == msg.sender, "Not message sender");

        IMessageRegistry.MessageStatus status = messageRegistry
            .getMessageStatus(messageId);
        require(
            status == IMessageRegistry.MessageStatus.PENDING ||
                status == IMessageRegistry.MessageStatus.FAILED,
            "Cannot cancel message"
        );

        messageRegistry.updateMessageStatus(
            messageId,
            IMessageRegistry.MessageStatus.CANCELLED
        );

        // Clean up storage
        delete submissions[messageId];
        delete messageSenders[messageId];

        return true;
    }

    function emergencyCancelMessage(
        bytes32 messageId
    ) external override returns (bool) {
        require(
            hasRole(EMERGENCY_ROLE, msg.sender),
            "Caller not emergency admin"
        );
        require(messageExists(messageId), "Message not found");

        messageRegistry.updateMessageStatus(
            messageId,
            IMessageRegistry.MessageStatus.CANCELLED
        );

        return true;
    }

    function updateProtocolComponent(
        bytes32 component,
        address newAddress
    ) external override {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller not admin");
        require(newAddress != address(0), "Invalid address");

        if (component == keccak256("REGISTRY")) {
            messageRegistry = IMessageRegistry(newAddress);
        } else if (component == keccak256("PROTOCOL")) {
            messageProtocol = IMessageProtocol(newAddress);
        } else if (component == keccak256("ROUTER")) {
            messageRouter = IMessageRouter(newAddress);
        } else if (component == keccak256("PROCESSOR")) {
            messageProcessor = IMessageProcessor(newAddress);
        } else {
            revert("Invalid component");
        }

        emit ComponentUpdated(component, newAddress);
    }

    function getProtocolConfig() external view override returns (bytes memory) {
        return
            abi.encode(
                baseFee,
                MAX_MESSAGE_SIZE,
                address(messageRegistry),
                address(messageProtocol),
                address(messageRouter),
                address(messageProcessor)
            );
    }

    function updateBaseFee(uint256 newBaseFee) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller not admin");
        baseFee = newBaseFee;
        emit FeeUpdated(newBaseFee);
    }

    function messageExists(bytes32 messageId) public view returns (bool) {
        return messageRegistry.messageExists(messageId);
    }

    function pause() external {
        require(
            hasRole(EMERGENCY_ROLE, msg.sender),
            "Caller not emergency admin"
        );
        _pause();
    }

    function unpause() external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller not admin");
        _unpause();
    }

    receive() external payable {}
}
