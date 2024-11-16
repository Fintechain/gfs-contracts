// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../../lib/wormhole-solidity-sdk/src/interfaces/IWormhole.sol";
import "../../../lib/wormhole-solidity-sdk/src/interfaces/IWormholeRelayer.sol";
import "../../interfaces/IMessageRouter.sol";
import "../../interfaces/ITargetRegistry.sol";
import "../../interfaces/IMessageHandler.sol";
import "../../interfaces/IMessageProcessor.sol";

/**
 * @title MessageRouter
 * @notice Routes ISO20022 messages between chains using Wormhole protocol
 */
contract MessageRouter is
    IMessageRouter,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    // Role definitions
    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    // Constants
    uint256 private constant GAS_LIMIT = 250_000;

    // Dependencies
    ITargetRegistry public immutable targetRegistry;
    IWormhole public immutable wormhole;
    IWormholeRelayer public immutable wormholeRelayer;

    IMessageProcessor public immutable messageProcessor; // Added

    // Storage
    mapping(bytes32 => bytes32) private deliveryHashes;
    mapping(bytes32 => bool) private routingStatus;
    mapping(uint16 => uint256) private chainGasLimits;

    // Events not in interface
    event ChainGasLimitUpdated(uint16 indexed chainId, uint256 gasLimit);
    event DeliveryCompleted(
        bytes32 indexed messageId,
        bytes32 indexed deliveryHash
    );

    /**
     * @notice Contract constructor
     * @param _wormholeRelayer Wormhole relayer address
     * @param _wormhole Wormhole core contract address
     * @param _targetRegistry Target registry contract address
     * @param _messageProcessor Message processpr contract address
     */
    constructor(
        address _wormholeRelayer,
        address _wormhole,
        address _targetRegistry,
        address _messageProcessor
    ) {
        wormholeRelayer = IWormholeRelayer(_wormholeRelayer);
        wormhole = IWormhole(_wormhole);
        targetRegistry = ITargetRegistry(_targetRegistry);
        messageProcessor = IMessageProcessor(_messageProcessor); // Added

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ROUTER_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);
    }

    /**
     * @notice Route a message to its target
     * @param messageId ID of the message to route
     * @param target Target address
     * @param targetChain Target chain ID
     * @param payload Message payload
     * @return result Routing result information
     */
    function routeMessage(
        bytes32 messageId,
        address target,
        uint16 targetChain,
        bytes calldata payload
    )
        external
        payable
        override
        whenNotPaused
        nonReentrant
        returns (RoutingResult memory)
    {
        require(
            hasRole(ROUTER_ROLE, msg.sender),
            "MessageRouter: Must have router role"
        );
        require(
            canRouteToTarget(target, targetChain),
            "MessageRouter: Invalid target"
        );
        require(payload.length > 0, "MessageRouter: Empty payload");

        uint256 deliveryCost = quoteRoutingFee(targetChain, payload.length);
        require(msg.value >= deliveryCost, "MessageRouter: Insufficient fee");

        bytes32 deliveryHash;
        if (targetChain == block.chainid) {
            // Local delivery
            deliveryHash = _routeLocal(messageId, target, payload);
        } else {
            // Cross-chain delivery via Wormhole
            deliveryHash = _routeCrossChain(
                messageId,
                target,
                targetChain,
                payload
            );
        }

        deliveryHashes[messageId] = deliveryHash;
        routingStatus[deliveryHash] = false;

        emit MessageRouted(
            messageId,
            msg.sender,
            target,
            targetChain,
            deliveryHash
        );

        return
            RoutingResult({
                messageId: messageId,
                success: true,
                deliveryHash: deliveryHash,
                timestamp: block.timestamp
            });
    }

    /**
     * @notice Calculate routing fee for a message
     * @param targetChain Target chain ID
     * @param payloadSize Size of the message payload
     * @return fee Required fee for routing
     */
    function quoteRoutingFee(
        uint16 targetChain,
        uint256 payloadSize
    ) public view override returns (uint256) {
        uint256 gasLimit = chainGasLimits[targetChain] == 0
            ? GAS_LIMIT
            : chainGasLimits[targetChain];

        (uint256 deliveryCost, ) = wormholeRelayer.quoteEVMDeliveryPrice(
            targetChain,
            payloadSize,
            gasLimit
        );

        return deliveryCost + wormhole.messageFee();
    }

    /**
     * @notice Get the delivery status of a routed message
     * @param deliveryHash Hash identifying the delivery
     * @return status Current delivery status
     */
    function getDeliveryStatus(
        bytes32 deliveryHash
    ) external view override returns (bool) {
        return routingStatus[deliveryHash];
    }

    /**
     * @notice Verify if a message can be routed to a target
     * @param target Target address
     * @param targetChain Target chain ID
     * @return canRoute Whether message can be routed
     */
    function canRouteToTarget(
        address target,
        uint16 targetChain
    ) public view override returns (bool) {
        return targetRegistry.isValidTarget(target, targetChain);
    }

    /**
     * @notice Route message locally
     * @param messageId Message identifier
     * @param target Target address
     * @param payload Message payload
     * @return deliveryHash Hash of the delivery
     */
    function _routeLocal(
        bytes32 messageId,
        address target,
        bytes memory payload
    ) private returns (bytes32) {
        // Current implementation is insufficient:
        (bool success, ) = target.call(payload);
        require(success, "Local delivery failed");

        // Should be:
        IMessageHandler handler = IMessageHandler(target);
        bytes memory result = handler.handleMessage(messageId, payload);

        IMessageProcessor.ProcessingResult memory procResult = messageProcessor.processMessage(
            messageId,
            handler.getSupportedMessageTypes()[0],
            result
        );

        //emit LocalMessageProcessed(messageId, procResult.success);
        return keccak256(abi.encode(messageId, block.timestamp));
    }

    /**
     * @notice Route message cross-chain via Wormhole
     */
    function _routeCrossChain(
        bytes32 messageId,
        address target,
        uint16 targetChain,
        bytes memory payload
    ) private returns (bytes32) {
        bytes memory vaaPayload = abi.encode(
            messageId,
            msg.sender,
            target,
            payload
        );

        uint256 gasLimit = chainGasLimits[targetChain] == 0
            ? GAS_LIMIT
            : chainGasLimits[targetChain];

        // Send message via Wormhole
        uint64 sequence = wormhole.publishMessage{value: wormhole.messageFee()}(
            0, // nonce
            vaaPayload,
            1 // consistency level
        );

        return keccak256(abi.encodePacked(sequence, targetChain));
    }

    /**
     * @notice Set gas limit for a specific chain
     */
    function setChainGasLimit(uint16 chainId, uint256 gasLimit) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "MessageRouter: Must have admin role"
        );
        require(gasLimit > 0, "MessageRouter: Invalid gas limit");

        chainGasLimits[chainId] = gasLimit;
        emit ChainGasLimitUpdated(chainId, gasLimit);
    }

    /**
     * @notice Mark a delivery as completed
     */
    function markDeliveryCompleted(bytes32 deliveryHash) external {
        require(
            hasRole(RELAYER_ROLE, msg.sender),
            "MessageRouter: Must have relayer role"
        );
        routingStatus[deliveryHash] = true;
        emit DeliveryCompleted(bytes32(0), deliveryHash);
    }

    /**
     * @notice Pause the router
     */
    function pause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "MessageRouter: Must have admin role"
        );
        _pause();
    }

    /**
     * @notice Unpause the router
     */
    function unpause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "MessageRouter: Must have admin role"
        );
        _unpause();
    }

    /**
     * @notice Withdraw accumulated fees
     */
    function withdrawFees() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "MessageRouter: Must have admin role"
        );

        uint256 balance = address(this).balance;
        require(balance > 0, "MessageRouter: No fees to withdraw");

        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "MessageRouter: Transfer failed");
    }

    /**
     * @notice Receive native tokens
     */
    receive() external payable {}
}
