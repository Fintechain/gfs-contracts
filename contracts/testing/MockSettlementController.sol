// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/ISettlementController.sol";

contract MockSettlementController is ISettlementController {
    mapping(bytes32 => Settlement) private settlements;
    mapping(bytes32 => bytes32[]) private messageSettlements;
    uint256 private mockFee;
    bool private settlementSuccess = true;

    function setQuoteResult(uint256 fee) external {
        mockFee = fee;
    }

    function setSettlementSuccess(bool success) external {
        settlementSuccess = success;
    }

    function initiateSettlement(
        bytes32 messageId,
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint16 targetChain,
        address recipient
    ) external payable returns (bytes32) {
        require(msg.value >= mockFee, "Insufficient settlement fee");

        bytes32 settlementId = keccak256(abi.encodePacked(
            messageId,
            sourceToken,
            targetToken,
            amount,
            targetChain,
            recipient
        ));

        settlements[settlementId] = Settlement({
            settlementId: settlementId,
            messageId: messageId,
            sourceToken: sourceToken,
            targetToken: targetToken,
            amount: amount,
            sourceChain: 1, // Mock source chain
            targetChain: targetChain,
            sender: msg.sender,
            recipient: recipient,
            status: SettlementStatus.PENDING,
            timestamp: block.timestamp
        });

        messageSettlements[messageId].push(settlementId);

        emit SettlementCreated(settlementId, messageId, amount);
        return settlementId;
    }

    function quoteSettlementFee(
        uint16 targetChain,
        uint256 amount
    ) external view returns (uint256) {
        return mockFee;
    }

    function processIncomingSettlement(
        bytes calldata settlementData,
        uint16 sourceChain
    ) external {
        // Mock implementation
    }

    function cancelSettlement(bytes32 settlementId) external returns (bool) {
        require(settlements[settlementId].settlementId == settlementId, "Settlement not found");
        
        settlements[settlementId].status = SettlementStatus.CANCELLED;
        emit SettlementStatusUpdated(settlementId, SettlementStatus.CANCELLED);
        
        return true;
    }

    function getSettlement(
        bytes32 settlementId
    ) external view returns (Settlement memory) {
        return settlements[settlementId];
    }

    function getSettlementsByMessage(
        bytes32 messageId
    ) external view returns (bytes32[] memory) {
        return messageSettlements[messageId];
    }
}