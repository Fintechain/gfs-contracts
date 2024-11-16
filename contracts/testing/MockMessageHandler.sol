// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IMessageHandler.sol";

contract MockMessageHandler is IMessageHandler {
    bool public shouldSucceed = true;
    bytes32[] public supportedTypes;
    mapping(bytes32 => bytes) public results;
    mapping(bytes32 => bool) public processed;

    event MessageHandled(
        bytes32 indexed messageId,
        bytes payload,
        bool success
    );

    function setShouldSucceed(bool _shouldSucceed) external {
        shouldSucceed = _shouldSucceed;
    }

    function addSupportedType(bytes32 messageType) external {
        supportedTypes.push(messageType);
    }

    function setResult(bytes32 messageId, bytes calldata result) external {
        results[messageId] = result;
    }

    function handleMessage(
        bytes32 messageId,
        bytes calldata payload
    ) external override returns (bytes memory) {
        require(!processed[messageId], "Message already processed");
        
        processed[messageId] = true;
        emit MessageHandled(messageId, payload, shouldSucceed);

        if (!shouldSucceed) {
            revert("Mock handler failure");
        }

        // Return preset result if exists, otherwise return default success
        if (results[messageId].length > 0) {
            return results[messageId];
        }

        // Default return for NOTIFICATION_ONLY
        return abi.encode(true);
    }

    function getSupportedMessageTypes() 
        external 
        view 
        override 
        returns (bytes32[] memory) 
    {
        return supportedTypes;
    }

    function wasProcessed(bytes32 messageId) external view returns (bool) {
        return processed[messageId];
    }
}