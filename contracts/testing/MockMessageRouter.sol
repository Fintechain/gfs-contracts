// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IMessageRouter.sol";

contract MockMessageRouter is IMessageRouter {
    // Test control variables
    mapping(bytes32 => RoutingResult) private routingResults;
    mapping(bytes32 => bool) private deliveryStatuses;
    mapping(uint16 => uint256) private chainGasLimits;
    uint256 private mockFee;
    uint256 private mockLocalFee;
    uint256 private mockCrossChainFee;
    bool private mockCanRoute = true;

    // Test helper functions
    function setQuoteResult(uint256 fee) external {
        mockFee = fee;
    }

    function setLocalFee(uint256 fee) external {
        mockLocalFee = fee;
    }

    function setCrossChainFee(uint256 fee) external {
        mockCrossChainFee = fee;
    }

    function setCanRoute(bool canRoute) external {
        mockCanRoute = canRoute;
    }

    function setDeliveryStatus(bytes32 deliveryHash, bool status) external {
        deliveryStatuses[deliveryHash] = status;
        emit MessageDelivered(bytes32(0), deliveryHash, status);
    }

    // Interface implementations
    function routeMessage(
        bytes32 messageId,
        address target,
        uint16 targetChain,
        bytes calldata payload
    ) external payable returns (RoutingResult memory) {
        bytes32 deliveryHash = keccak256(
            abi.encodePacked(messageId, target, targetChain)
        );

        RoutingResult memory result = RoutingResult({
            messageId: messageId,
            success: true,
            deliveryHash: deliveryHash,
            timestamp: block.timestamp
        });

        routingResults[messageId] = result;
        deliveryStatuses[deliveryHash] = true;

        emit MessageRouted(
            messageId,
            msg.sender,
            target,
            targetChain,
            deliveryHash
        );

        return result;
    }

    function quoteRoutingFee(
        uint16 targetChain,
        uint256 payloadSize
    ) external view returns (uint256) {
        return mockFee;
    }

    function calculateLocalRoutingFee(
        uint256 payloadSize
    ) external view returns (uint256) {
        return mockLocalFee;
    }

    function calculateCrossChainProcessingFee(
        uint256 payloadSize
    ) external view returns (uint256) {
        return mockCrossChainFee;
    }

    function getDeliveryStatus(bytes32 deliveryHash) external view returns (bool) {
        return deliveryStatuses[deliveryHash];
    }

    function canRouteToTarget(
        address target,
        uint16 targetChain
    ) external view returns (bool) {
        return mockCanRoute;
    }

    function markDeliveryCompleted(bytes32 deliveryHash) external {
        deliveryStatuses[deliveryHash] = true;
        emit DeliveryCompleted(bytes32(0), deliveryHash);
    }

    function setChainGasLimit(uint16 chainId, uint256 gasLimit) external {
        chainGasLimits[chainId] = gasLimit;
        emit ChainGasLimitUpdated(chainId, gasLimit);
    }

    function setCrossChainFeeParameters(
        uint256 baseFee,
        uint256 feeMultiplier
    ) external {
        emit CrossChainFeesUpdated(baseFee, feeMultiplier);
    }

    function withdrawFees() external {
        // Mock implementation - no actual fee handling
    }
}