// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IMessageProtocol.sol";

contract MockMessageProtocol is IMessageProtocol {
    mapping(bytes32 => MessageFormat) private messageFormats;
    ProtocolVersion private protocolVersion;
    bool private validationResult = true;

    function setValidationResult(bool result) external {
        validationResult = result;
    }

    function validateMessage(
        bytes32 messageType,
        bytes calldata payload
    ) external view returns (bool) {
        return validationResult;  // Just return the validation result directly
    }

    function registerMessageFormat(
        bytes32 messageType,
        bytes4[] calldata requiredFields,
        bytes calldata schema
    ) external {
        messageFormats[messageType] = MessageFormat({
            messageType: messageType,
            requiredFields: requiredFields,
            schema: schema,
            isSupported: true
        });
        emit MessageFormatRegistered(messageType, schema);
    }

    function updateProtocolVersion(
        uint16 major,
        uint16 minor,
        uint16 patch
    ) external {
        protocolVersion = ProtocolVersion({
            major: major,
            minor: minor,
            patch: patch,
            active: true
        });
        emit ProtocolVersionUpdated(major, minor, patch);
    }

    function getMessageFormat(
        bytes32 messageType
    ) external view returns (MessageFormat memory) {
        return messageFormats[messageType];
    }

    function getProtocolVersion() external view returns (ProtocolVersion memory) {
        return protocolVersion;
    }

    function isMessageTypeSupported(
        bytes32 messageType
    ) external view returns (bool) {
        return true;  // Always return true for testing
    }
}