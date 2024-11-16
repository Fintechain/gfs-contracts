// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IMessageRegistry.sol";

contract MockMessageRegistry is IMessageRegistry {
    mapping(bytes32 => ISO20022Message) private messages;
    mapping(address => bytes32[]) private senderMessages;
    mapping(address => bytes32[]) private targetMessages;
    
    // Test helper functions
    function setMessage(ISO20022Message memory message) external {
        messages[message.messageId] = message;
        senderMessages[message.sender].push(message.messageId);
        targetMessages[message.target].push(message.messageId);
    }

    function clearMessages() external {
        // Can be used to reset state between tests
    }

    // Interface implementations
    function registerMessage(
        bytes32 messageType,
        bytes32 messageHash,
        address target,
        uint16 targetChain,
        bytes calldata payload
    ) external returns (bytes32) {
        require(target != address(0), "Invalid target address");
        require(payload.length > 0, "Empty payload");

        bytes32 messageId = keccak256(
            abi.encodePacked(
                messageType,
                messageHash,
                msg.sender,
                target,
                targetChain
            )
        );

        require(!messageExists(messageId), "Message already exists");

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

    function updateMessageStatus(
        bytes32 messageId,
        MessageStatus newStatus
    ) external {
        require(messageExists(messageId), "Message not found");
        
        MessageStatus oldStatus = messages[messageId].status;
        messages[messageId].status = newStatus;
        
        emit MessageStatusUpdated(messageId, oldStatus, newStatus);
    }

    function getMessage(
        bytes32 messageId
    ) external view returns (ISO20022Message memory) {
        require(messageExists(messageId), "Message not found");
        return messages[messageId];
    }

    function messageExists(bytes32 messageId) public view returns (bool) {
        return messages[messageId].messageId == messageId;
    }

    function getMessageStatus(
        bytes32 messageId
    ) external view returns (MessageStatus) {
        require(messageExists(messageId), "Message not found");
        return messages[messageId].status;
    }

    function getMessagesBySender(
        address sender
    ) external view returns (bytes32[] memory) {
        return senderMessages[sender];
    }

    function getMessagesByTarget(
        address target
    ) external view returns (bytes32[] memory) {
        return targetMessages[target];
    }

    // Additional test helper functions
    function setMessageStatus(bytes32 messageId, MessageStatus status) external {
        messages[messageId].status = status;
    }

    function addMessageToSender(address sender, bytes32 messageId) external {
        senderMessages[sender].push(messageId);
    }

    function addMessageToTarget(address target, bytes32 messageId) external {
        targetMessages[target].push(messageId);
    }

    function clearSenderMessages(address sender) external {
        delete senderMessages[sender];
    }

    function clearTargetMessages(address target) external {
        delete targetMessages[target];
    }
}