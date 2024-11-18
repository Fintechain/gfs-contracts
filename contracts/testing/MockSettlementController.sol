// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/ISettlementController.sol";

contract MockSettlementController is ISettlementController {
    mapping(bytes32 => Settlement) internal settlements;
    mapping(bytes32 => bytes32[]) internal messageSettlements;

    function processSettlement(
        bytes32 messageId,
        address token,
        uint256 amount,
        address recipient
    ) external returns (bytes32) {
        bytes32 settlementId = bytes32(uint256(1));
        
        emit SettlementProcessed(settlementId, messageId, amount, recipient);
        emit SettlementStatusUpdated(settlementId, SettlementStatus.COMPLETED);
        
        return settlementId;
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