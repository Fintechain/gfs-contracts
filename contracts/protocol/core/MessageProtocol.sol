// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../../interfaces/IMessageProtocol.sol";

/**
 * @title MessageProtocol
 * @notice Implementation of IMessageProtocol for managing ISO20022 message standards
 * @dev Handles protocol versioning, message format registration, and validation
 */
contract MessageProtocol is IMessageProtocol, AccessControl, Pausable {
    // Role definitions
    bytes32 public constant PROTOCOL_ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");
    bytes32 public constant FORMAT_ADMIN_ROLE = keccak256("FORMAT_ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    // Storage
    mapping(bytes32 => MessageFormat) private messageFormats;
    mapping(string => uint256) private supportedVersions;
    mapping(bytes32 => bool) private activeFormats;
    
    // Current protocol version
    ProtocolVersion private currentVersion;

    // Events for protocol changes
    event SchemaUpdated(bytes32 indexed messageType, bytes newSchema);
    event FormatDeactivated(bytes32 indexed messageType);
    event FormatActivated(bytes32 indexed messageType);

    /**
     * @notice Contract constructor
     * @dev Sets up initial roles and protocol version
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROTOCOL_ADMIN_ROLE, msg.sender);
        _grantRole(FORMAT_ADMIN_ROLE, msg.sender);
        _grantRole(VALIDATOR_ROLE, msg.sender);

        // Initialize protocol version
        currentVersion = ProtocolVersion({
            major: 1,
            minor: 0,
            patch: 0,
            active: true
        });
    }

    /**
     * @notice Validate message against protocol standards
     * @param messageType Type of message to validate
     * @param payload Message payload to validate
     * @return isValid Whether the message is valid
     */
    function validateMessage(
        bytes32 messageType,
        bytes calldata payload
    ) external view override whenNotPaused returns (bool) {
        require(
            hasRole(VALIDATOR_ROLE, msg.sender),
            "MessageProtocol: Caller must have VALIDATOR_ROLE"
        );
        
        // Check if message type is supported
        if (!activeFormats[messageType]) {
            return false;
        }

        MessageFormat storage format = messageFormats[messageType];
        if (!format.isSupported) {
            return false;
        }

        // Check payload length
        if (payload.length < 4) {
            return false;
        }

        // Validate required fields presence
        for (uint256 i = 0; i < format.requiredFields.length; i++) {
            bool fieldFound = false;
            for (uint256 j = 0; j < payload.length - 3; j++) {
                bytes4 fieldSelector = bytes4(payload[j:j + 4]);
                if (fieldSelector == format.requiredFields[i]) {
                    fieldFound = true;
                    break;
                }
            }
            if (!fieldFound) {
                return false;
            }
        }

        // Additional schema validation could be implemented here
        return true;
    }

    /**
     * @notice Register new message format
     * @param messageType Type of message to register
     * @param requiredFields Required field selectors
     * @param schema Message schema
     */
    function registerMessageFormat(
        bytes32 messageType,
        bytes4[] calldata requiredFields,
        bytes calldata schema
    ) external override whenNotPaused {
        require(
            hasRole(FORMAT_ADMIN_ROLE, msg.sender),
            "MessageProtocol: Caller must have FORMAT_ADMIN_ROLE"
        );
        require(schema.length > 0, "MessageProtocol: Schema cannot be empty");
        require(
            requiredFields.length > 0,
            "MessageProtocol: Required fields cannot be empty"
        );

        messageFormats[messageType] = MessageFormat({
            messageType: messageType,
            requiredFields: requiredFields,
            schema: schema,
            isSupported: true
        });

        activeFormats[messageType] = true;

        emit MessageFormatRegistered(messageType, schema);
    }

    /**
     * @notice Update protocol version
     * @param major Major version number
     * @param minor Minor version number
     * @param patch Patch version number
     */
    function updateProtocolVersion(
        uint16 major,
        uint16 minor,
        uint16 patch
    ) external override whenNotPaused {
        require(
            hasRole(PROTOCOL_ADMIN_ROLE, msg.sender),
            "MessageProtocol: Caller must have PROTOCOL_ADMIN_ROLE"
        );

        currentVersion = ProtocolVersion({
            major: major,
            minor: minor,
            patch: patch,
            active: true
        });

        emit ProtocolVersionUpdated(major, minor, patch);
    }

    /**
     * @notice Get message format specification
     * @param messageType Type of message
     * @return format Message format details
     */
    function getMessageFormat(
        bytes32 messageType
    ) external view override returns (MessageFormat memory) {
        return messageFormats[messageType];
    }

    /**
     * @notice Get current protocol version
     * @return version Protocol version information
     */
    function getProtocolVersion(
    ) external view override returns (ProtocolVersion memory) {
        return currentVersion;
    }

    /**
     * @notice Check if message type is supported
     * @param messageType Type of message
     * @return isSupported Whether message type is supported
     */
    function isMessageTypeSupported(
        bytes32 messageType
    ) external view override returns (bool) {
        return activeFormats[messageType] && messageFormats[messageType].isSupported;
    }

    /**
     * @notice Deactivate a message format
     * @param messageType Type of message to deactivate
     */
    function deactivateMessageFormat(
        bytes32 messageType
    ) external whenNotPaused {
        require(
            hasRole(FORMAT_ADMIN_ROLE, msg.sender),
            "MessageProtocol: Caller must have FORMAT_ADMIN_ROLE"
        );
        require(
            activeFormats[messageType],
            "MessageProtocol: Format not active"
        );

        activeFormats[messageType] = false;
        emit FormatDeactivated(messageType);
    }

    /**
     * @notice Reactivate a message format
     * @param messageType Type of message to reactivate
     */
    function activateMessageFormat(
        bytes32 messageType
    ) external whenNotPaused {
        require(
            hasRole(FORMAT_ADMIN_ROLE, msg.sender),
            "MessageProtocol: Caller must have FORMAT_ADMIN_ROLE"
        );
        require(
            !activeFormats[messageType],
            "MessageProtocol: Format already active"
        );
        require(
            messageFormats[messageType].isSupported,
            "MessageProtocol: Format not registered"
        );

        activeFormats[messageType] = true;
        emit FormatActivated(messageType);
    }

    /**
     * @notice Update message schema
     * @param messageType Type of message
     * @param newSchema New schema to set
     */
    function updateMessageSchema(
        bytes32 messageType,
        bytes calldata newSchema
    ) external whenNotPaused {
        require(
            hasRole(FORMAT_ADMIN_ROLE, msg.sender),
            "MessageProtocol: Caller must have FORMAT_ADMIN_ROLE"
        );
        require(
            messageFormats[messageType].isSupported,
            "MessageProtocol: Format not registered"
        );
        require(
            newSchema.length > 0,
            "MessageProtocol: Schema cannot be empty"
        );

        messageFormats[messageType].schema = newSchema;
        emit SchemaUpdated(messageType, newSchema);
    }

    /**
     * @notice Pause protocol operations
     */
    function pause() external {
        require(
            hasRole(PROTOCOL_ADMIN_ROLE, msg.sender),
            "MessageProtocol: Caller must have PROTOCOL_ADMIN_ROLE"
        );
        _pause();
    }

    /**
     * @notice Unpause protocol operations
     */
    function unpause() external {
        require(
            hasRole(PROTOCOL_ADMIN_ROLE, msg.sender),
            "MessageProtocol: Caller must have PROTOCOL_ADMIN_ROLE"
        );
        _unpause();
    }
}