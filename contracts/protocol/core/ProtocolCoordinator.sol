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
import "../../interfaces/ISettlementController.sol";

/**
 * @title ProtocolCoordinator
 * @notice Main orchestration contract for the GFS Protocol
 * @dev Coordinates interactions between all protocol components
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
    ISettlementController public settlementController;

    // Protocol configuration
    uint256 public baseFee;
    uint256 public constant MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB

    // Message tracking
    mapping(bytes32 => MessageSubmission) private submissions;
    mapping(bytes32 => address) private messageSenders;
    mapping(bytes32 => bytes32) private messageSettlements;

    // Events
    event ComponentUpdated(
        bytes32 indexed component,
        address indexed newAddress
    );
    event FeeUpdated(uint256 newBaseFee);
    event MessageRetryInitiated(bytes32 indexed messageId);

    /**
     * @notice Contract constructor
     * @param _registry MessageRegistry address
     * @param _protocol MessageProtocol address
     * @param _router MessageRouter address
     * @param _processor MessageProcessor address
     * @param _settlement SettlementController address
     */
    constructor(
        address _registry,
        address _protocol,
        address _router,
        address _processor,
        address _settlement
    ) {
        require(_registry != address(0), "Invalid registry address");
        require(_protocol != address(0), "Invalid protocol address");
        require(_router != address(0), "Invalid router address");
        require(_processor != address(0), "Invalid processor address");
        require(_settlement != address(0), "Invalid settlement address");

        messageRegistry = IMessageRegistry(_registry);
        messageProtocol = IMessageProtocol(_protocol);
        messageRouter = IMessageRouter(_router);
        messageProcessor = IMessageProcessor(_processor);
        settlementController = ISettlementController(_settlement);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);

        baseFee = 0.001 ether; // Initial base fee
    }

    /**
     * @inheritdoc IProtocolCoordinator
     */
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
        (
            uint256 _baseFee,
            uint256 _deliveryFee,
            uint256 _settlementFee
        ) = quoteMessageFee(submission);
        require(
            msg.value >= _baseFee + _deliveryFee + _settlementFee,
            "Insufficient fee"
        );

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

        // Register message first to get messageId
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

        // Handle settlement if required
        if (_requiresSettlement(submission)) {
            bytes32 settlementId = _initiateSettlement(
                messageId,
                submission,
                _settlementFee
            );
            messageSettlements[messageId] = settlementId;
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

    /**
     * @inheritdoc IProtocolCoordinator
     */
    function quoteMessageFee(
        MessageSubmission calldata submission
    )
        public
        view
        override
        returns (uint256 _baseFee, uint256 _deliveryFee, uint256 _settlementFee)
    {
        _baseFee = baseFee;

        // Calculate delivery fee from router
        _deliveryFee = messageRouter.quoteRoutingFee(
            submission.targetChain,
            submission.payload.length
        );

        // Calculate settlement fee if needed
        if (_requiresSettlement(submission)) {
            _settlementFee = settlementController.quoteSettlementFee(
                submission.targetChain,
                submission.settlementData.amount
            );
        }

        return (_baseFee, _deliveryFee, _settlementFee);
    }

    /**
     * @inheritdoc IProtocolCoordinator
     */
    function getMessageStatus(
        bytes32 messageId
    )
        external
        view
        override
        returns (
            uint8 processingStatus,
            bytes32 settlementId,
            uint8 settlementStatus
        )
    {
        require(messageExists(messageId), "Message not found");

        // Get message status
        IMessageRegistry.MessageStatus status = messageRegistry
            .getMessageStatus(messageId);
        processingStatus = uint8(status);

        // Get settlement status if exists
        settlementId = messageSettlements[messageId];
        if (settlementId != bytes32(0)) {
            ISettlementController.Settlement
                memory settlement = settlementController.getSettlement(
                    settlementId
                );
            settlementStatus = uint8(settlement.status);
        }

        return (processingStatus, settlementId, settlementStatus);
    }

    /**
     * @inheritdoc IProtocolCoordinator
     */
    function retryMessage(
        bytes32 messageId
    ) external payable override whenNotPaused nonReentrant returns (bool) {
        require(messageExists(messageId), "Message not found");
        require(messageSenders[messageId] == msg.sender, "Not message sender");

        // Get submission from storage
        MessageSubmission memory submission = submissions[messageId];

        // Calculate retry fees without using quoteMessageFee
        uint256 _deliveryFee = messageRouter.quoteRoutingFee(
            submission.targetChain,
            submission.payload.length
        );

        uint256 _settlementFee = 0;
        if (_requiresSettlement(submission)) {
            _settlementFee = settlementController.quoteSettlementFee(
                submission.targetChain,
                submission.settlementData.amount
            );
        }

        require(msg.value >= _deliveryFee + _settlementFee, "Insufficient fee");

        // Retry routing
        messageRouter.routeMessage{value: _deliveryFee}(
            messageId,
            submission.target,
            submission.targetChain,
            submission.payload
        );

        // If there was a settlement, retry it
        if (_requiresSettlement(submission)) {
            bytes32 oldSettlementId = messageSettlements[messageId];
            if (oldSettlementId != bytes32(0)) {
                // Cancel old settlement if it exists
                settlementController.cancelSettlement(oldSettlementId);
            }

            // Create new settlement
            bytes32 newSettlementId = _initiateSettlement(
                messageId,
                submission,
                _settlementFee
            );
            messageSettlements[messageId] = newSettlementId;
        }

        emit MessageRetryInitiated(messageId);
        return true;
    }

    /**
     * @inheritdoc IProtocolCoordinator
     */
    function cancelMessage(bytes32 messageId) external override returns (bool) {
        require(messageExists(messageId), "Message not found");
        require(messageSenders[messageId] == msg.sender, "Not message sender");

        // Check message can be cancelled
        IMessageRegistry.MessageStatus status = messageRegistry
            .getMessageStatus(messageId);
        require(
            status == IMessageRegistry.MessageStatus.PENDING ||
                status == IMessageRegistry.MessageStatus.FAILED,
            "Cannot cancel message"
        );

        // Cancel any associated settlement
        bytes32 settlementId = messageSettlements[messageId];
        if (settlementId != bytes32(0)) {
            settlementController.cancelSettlement(settlementId);
            delete messageSettlements[messageId];
        }

        // Update message status to FAILED since there's no CANCELLED status
        messageRegistry.updateMessageStatus(
            messageId,
            IMessageRegistry.MessageStatus.CANCELLED
        );

        // Clean up coordinator storage
        delete submissions[messageId];
        delete messageSenders[messageId];

        emit IMessageRegistry.MessageStatusUpdated(
            messageId,
            status,
            IMessageRegistry.MessageStatus.CANCELLED
        );

        return true;
    }

    /**
     * @inheritdoc IProtocolCoordinator
     */
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
        } else if (component == keccak256("SETTLEMENT")) {
            settlementController = ISettlementController(newAddress);
        } else {
            revert("Invalid component");
        }

        emit ComponentUpdated(component, newAddress);
    }

    /**
     * @inheritdoc IProtocolCoordinator
     */
    function emergencyCancelMessage(
        bytes32 messageId
    ) external override returns (bool) {
        require(
            hasRole(EMERGENCY_ROLE, msg.sender),
            "Caller not emergency admin"
        );
        require(messageExists(messageId), "Message not found");

        // Force cancel settlement if exists
        bytes32 settlementId = messageSettlements[messageId];
        if (settlementId != bytes32(0)) {
            settlementController.cancelSettlement(settlementId);
        }

        // Update message status
        messageRegistry.updateMessageStatus(
            messageId,
            IMessageRegistry.MessageStatus.CANCELLED
        );

        return true;
    }

    /**
     * @inheritdoc IProtocolCoordinator
     */
    function messageRequiresSettlement(
        bytes32 messageType,
        bytes calldata payload
    ) external pure override returns (bool) {
        // Check if message type requires settlement
        // This could be expanded based on protocol requirements
        return _requiresSettlement(messageType, payload);
    }

    /**
     * @inheritdoc IProtocolCoordinator
     */
    function getMessageResult(
        bytes32 messageId
    )
        external
        view
        override
        returns (bool success, bytes memory result, bytes memory settlementData)
    {
        require(messageExists(messageId), "Message not found");

        // Get processing result
        IMessageProcessor.ProcessingResult memory procResult = messageProcessor
            .getProcessingStatus(messageId);

        // Get settlement data if exists
        bytes32 settlementId = messageSettlements[messageId];
        if (settlementId != bytes32(0)) {
            ISettlementController.Settlement
                memory settlement = settlementController.getSettlement(
                    settlementId
                );
            settlementData = abi.encode(settlement);
        }

        return (procResult.success, procResult.result, settlementData);
    }

    /**
     * @inheritdoc IProtocolCoordinator
     */
    function getProtocolConfig() external view override returns (bytes memory) {
        return
            abi.encode(
                baseFee,
                MAX_MESSAGE_SIZE,
                address(messageRegistry),
                address(messageProtocol),
                address(messageRouter),
                address(messageProcessor),
                address(settlementController)
            );
    }

    /**
     * @notice Updates the base protocol fee
     * @param newBaseFee New fee amount
     */
    function updateBaseFee(uint256 newBaseFee) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller not admin");
        baseFee = newBaseFee;
        emit FeeUpdated(newBaseFee);
    }

    /**
     * @notice Checks if message exists
     * @param messageId Message identifier
     * @return exists Whether message exists
     */
    function messageExists(bytes32 messageId) public view returns (bool) {
        return messageRegistry.messageExists(messageId);
    }

    /**
     * @notice Generate unique message identifier
     */
    function _generateMessageId(
        bytes32 messageType,
        bytes32 messageHash,
        address sender,
        address target,
        uint16 targetChain
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    messageType,
                    messageHash,
                    sender,
                    target,
                    targetChain,
                    block.timestamp
                )
            );
    }

    /**
     * @notice Check if message requires settlement
     */
    function _requiresSettlement(
        MessageSubmission memory submission
    ) internal pure returns (bool) {
        return submission.settlementData.amount > 0;
    }

    /**
     * @notice Check if specific message type and payload requires settlement
     */
    function _requiresSettlement(
        bytes32 messageType,
        bytes memory payload
    ) internal pure returns (bool) {
        // Implement specific settlement requirements based on
        // message type and payload analysis
        return false; // Placeholder implementation
    }

    /**
     * @notice Initiate settlement for a message
     */
    function _initiateSettlement(
        bytes32 messageId,
        MessageSubmission memory submission,
        uint256 settlementFee
    ) internal returns (bytes32) {
        return
            settlementController.initiateSettlement{value: settlementFee}(
                messageId,
                submission.settlementData.sourceToken,
                submission.settlementData.targetToken,
                submission.settlementData.amount,
                submission.targetChain,
                submission.settlementData.recipient
            );
    }

    /**
     * @notice Pause protocol operations
     */
    function pause() external {
        require(
            hasRole(EMERGENCY_ROLE, msg.sender),
            "Caller not emergency admin"
        );
        _pause();
    }

    /**
     * @notice Unpause protocol operations
     */
    function unpause() external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller not admin");
        _unpause();
    }

    /**
     * @notice Receive native tokens
     */
    receive() external payable {}
}
