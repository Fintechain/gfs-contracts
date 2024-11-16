// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IMessageRouter.sol";

contract MockMessageRouter is IMessageRouter {
    mapping(bytes32 => RoutingResult) private routingResults;
    mapping(bytes32 => bool) private deliveryStatuses;
    uint256 private mockFee;
    bool private mockCanRoute = true;

    function setQuoteResult(uint256 fee) external {
        mockFee = fee;
    }

    function setCanRoute(bool canRoute) external {
        mockCanRoute = canRoute;
    }

    function setDeliveryStatus(bytes32 deliveryHash, bool status) external {
        deliveryStatuses[deliveryHash] = status;
    }

    function routeMessage(
        bytes32 messageId,
        address target,
        uint16 targetChain,
        bytes calldata payload
    ) external payable returns (RoutingResult memory) {
        require(msg.value >= mockFee, "Insufficient fee");
        
        bytes32 deliveryHash = keccak256(abi.encodePacked(messageId, target, targetChain));
        RoutingResult memory result = RoutingResult({
            messageId: messageId,
            success: true,
            deliveryHash: deliveryHash,
            timestamp: block.timestamp
        });

        routingResults[messageId] = result;
        deliveryStatuses[deliveryHash] = true;

        emit MessageRouted(messageId, msg.sender, target, targetChain, deliveryHash);
        emit MessageDelivered(messageId, deliveryHash, true);

        return result;
    }

    function quoteRoutingFee(
        uint16 targetChain,
        uint256 payloadSize
    ) external view returns (uint256) {
        return mockFee;
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
}