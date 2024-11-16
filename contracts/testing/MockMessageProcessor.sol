// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IMessageProcessor.sol";

contract MockMessageProcessor is IMessageProcessor {
    mapping(bytes32 => ProcessingResult) private results;
    mapping(bytes32 => address) private handlers;
    mapping(bytes32 => ProcessingAction) private requiredActions;
    bool private processingSuccess = true;

    function setProcessingSuccess(bool success) external {
        processingSuccess = success;
    }

    function setRequiredAction(bytes32 messageType, ProcessingAction action) external {
        requiredActions[messageType] = action;
    }

    function processMessage(
        bytes32 messageId,
        bytes32 messageType,
        bytes calldata payload
    ) external returns (ProcessingResult memory) {
        ProcessingAction action = requiredActions[messageType];
        
        ProcessingResult memory result = ProcessingResult({
            messageId: messageId,
            action: action,
            success: processingSuccess,
            result: payload,
            settlementId: bytes32(0)
        });

        if (action == ProcessingAction.SETTLEMENT_REQUIRED) {
            result.settlementId = keccak256(abi.encodePacked(messageId, "settlement"));
        }

        results[messageId] = result;

        emit ProcessingStarted(messageId, messageType, action);
        emit ProcessingCompleted(messageId, processingSuccess, result.settlementId);

        return result;
    }

    function registerMessageHandler(bytes32 messageType, address handler) external {
        handlers[messageType] = handler;
        emit HandlerRegistered(messageType, handler, msg.sender);
    }

    function getProcessingStatus(
        bytes32 messageId
    ) external view returns (ProcessingResult memory) {
        return results[messageId];
    }

    function hasHandler(bytes32 messageType) external view returns (bool) {
        return handlers[messageType] != address(0);
    }

    function getRequiredAction(
        bytes32 messageType
    ) external view returns (ProcessingAction) {
        return requiredActions[messageType];
    }
}