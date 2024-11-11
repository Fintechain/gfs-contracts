// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMessageProtocol
 * @notice Interface defining the protocol standards for ISO20022 message handling
 */
interface IMessageProtocol {
    /// @notice Protocol version information
    struct ProtocolVersion {
        uint16 major;
        uint16 minor;
        uint16 patch;
        bool active;
    }

    /// @notice Message format specification
    struct MessageFormat {
        bytes32 messageType;
        bytes4[] requiredFields;
        bytes schema;
        bool isSupported;
    }

    /// @notice Emitted when protocol version is updated
    event ProtocolVersionUpdated(
        uint16 major,
        uint16 minor,
        uint16 patch
    );

    /// @notice Emitted when message format is registered
    event MessageFormatRegistered(
        bytes32 indexed messageType,
        bytes schema
    );

    /**
     * @notice Validate message against protocol standards
     * @param messageType Type of message
     * @param payload Message payload
     * @return isValid Whether message is valid
     */
    function validateMessage(
        bytes32 messageType,
        bytes calldata payload
    ) external view returns (bool);

    /**
     * @notice Register new message format
     * @param messageType Type of message
     * @param requiredFields Required field selectors
     * @param schema Message schema
     */
    function registerMessageFormat(
        bytes32 messageType,
        bytes4[] calldata requiredFields,
        bytes calldata schema
    ) external;

    /**
     * @notice Update protocol version
     * @param major Major version
     * @param minor Minor version
     * @param patch Patch version
     */
    function updateProtocolVersion(
        uint16 major,
        uint16 minor,
        uint16 patch
    ) external;

    /**
     * @notice Get message format specification
     * @param messageType Type of message
     * @return format Message format details
     */
    function getMessageFormat(
        bytes32 messageType
    ) external view returns (MessageFormat memory);

    /**
     * @notice Get current protocol version
     * @return version Protocol version information
     */
    function getProtocolVersion() external view returns (ProtocolVersion memory);

    /**
     * @notice Check if message type is supported
     * @param messageType Type of message
     * @return isSupported Whether message type is supported
     */
    function isMessageTypeSupported(
        bytes32 messageType
    ) external view returns (bool);
}