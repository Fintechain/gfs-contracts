// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/ISettlementController.sol";

contract MockSettlementController is ISettlementController {
    bytes32 public mockSettlementId = bytes32(uint256(1));
    mapping(bytes32 => Settlement) internal settlements;
    mapping(bytes32 => bytes32[]) internal messageSettlements;

    // Function to set a specific settlement ID for testing
    function setMockSettlementId(bytes32 _settlementId) external {
        mockSettlementId = _settlementId;
    }

    function processSettlement(
        bytes32 messageId,
        address token,
        uint256 amount,
        address recipient
    ) external returns (bytes32) {
        emit SettlementProcessed(mockSettlementId, messageId, amount, recipient);
        emit SettlementStatusUpdated(mockSettlementId, SettlementStatus.COMPLETED);
        
        return mockSettlementId;
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