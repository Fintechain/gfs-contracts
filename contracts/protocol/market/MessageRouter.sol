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

contract MessageRouter is
    IMessageRouter,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    // Constants for chain identification
    uint16 public constant LOCAL_CHAIN = 1; // Special value for local routing

    // Role definitions
    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    // Constants
    uint256 private constant GAS_LIMIT = 250_000;
    uint256 private constant BASE_LOCAL_FEE = 0.001 ether;
    uint256 private constant PAYLOAD_FEE_MULTIPLIER = 100 wei;

    // Cross-chain fee parameters (adjustable)
    uint256 private baseCrossChainFee = 0.002 ether;
    uint256 private crossChainFeeMultiplier = 200 wei;

    // Dependencies
    ITargetRegistry public immutable targetRegistry;
    IWormhole public immutable wormhole;
    IWormholeRelayer public immutable wormholeRelayer;
    IMessageProcessor public immutable messageProcessor;

    // Storage
    // Storea
    mapping(bytes32 => bytes32) private deliveryHashes;
    mapping(bytes32 => bool) private routingStatus;
    mapping(uint16 => uint256) private chainGasLimits;

    constructor(
        address _wormholeRelayer,
        address _wormhole,
        address _targetRegistry,
        address _messageProcessor
    ) {
        wormholeRelayer = IWormholeRelayer(_wormholeRelayer);
        wormhole = IWormhole(_wormhole);
        targetRegistry = ITargetRegistry(_targetRegistry);
        messageProcessor = IMessageProcessor(_messageProcessor);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ROUTER_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);
    }

    function calculateLocalRoutingFee(
        uint256 payloadSize
    ) public pure override returns (uint256) {
        return BASE_LOCAL_FEE + (payloadSize * PAYLOAD_FEE_MULTIPLIER);
    }

    function calculateCrossChainProcessingFee(
        uint256 payloadSize
    ) public view override returns (uint256) {
        return baseCrossChainFee + (payloadSize * crossChainFeeMultiplier);
    }

    function quoteRoutingFee(
        uint16 targetChain,
        uint256 payloadSize
    ) public view override returns (uint256) {
        // For local delivery, only charge local processing fee
        if (isLocalDelivery(targetChain)) {
            return calculateLocalRoutingFee(payloadSize);
        }

        // For cross-chain delivery, include our processing fee plus Wormhole fees
        uint256 processingFee = calculateCrossChainProcessingFee(payloadSize);

        uint256 gasLimit = chainGasLimits[targetChain] == 0
            ? GAS_LIMIT
            : chainGasLimits[targetChain];

        (uint256 deliveryCost, ) = wormholeRelayer.quoteEVMDeliveryPrice(
            targetChain,
            payloadSize,
            gasLimit
        );

        return processingFee + deliveryCost + wormhole.messageFee();
    }

    function setCrossChainFeeParameters(
        uint256 baseFee,
        uint256 feeMultiplier
    ) external override {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "MessageRouter: Must have admin role"
        );

        baseCrossChainFee = baseFee;
        crossChainFeeMultiplier = feeMultiplier;

        emit CrossChainFeesUpdated(baseFee, feeMultiplier);
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
        if (isLocalDelivery(targetChain)) {
            // Local delivery
            deliveryHash = _routeLocal(messageId, target, payload);

            // Refund excess payment for local delivery
            uint256 excess = msg.value - deliveryCost;
            if (excess > 0) {
                (bool success, ) = msg.sender.call{value: excess}("");
                require(success, "MessageRouter: Refund failed");
            }
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
     * @notice Determine if a message should be processed locally
     * @param targetChain The target chain ID
     * @return true if message should be processed locally
     */
    function isLocalDelivery(uint16 targetChain) public view returns (bool) {
        return targetChain == LOCAL_CHAIN;
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
        // Get message type and let processor handle it
        IMessageHandler handler = IMessageHandler(target);
        bytes32 messageType = handler.getSupportedMessageTypes()[0];

        // Let processor do the handling
        IMessageProcessor.ProcessingResult memory procResult = messageProcessor
            .processMessage(
                messageId,
                messageType,
                payload // Pass original payload, not result
            );

        // Mark delivery as completed immediately for local routing
        bytes32 deliveryHash = keccak256(
            abi.encode(messageId, block.timestamp)
        );
        routingStatus[deliveryHash] = true;

        emit DeliveryCompleted(messageId, deliveryHash);
        emit MessageDelivered(messageId, deliveryHash, true);

        return deliveryHash;
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
        // Calculate our processing fee to keep
       /*  uint256 processingFee = calculateCrossChainProcessingFee(
            payload.length
        ); */

        // Calculate Wormhole fees
        uint256 gasLimit = chainGasLimits[targetChain] == 0
            ? GAS_LIMIT
            : chainGasLimits[targetChain];

        (uint256 deliveryCost, ) = wormholeRelayer.quoteEVMDeliveryPrice(
            targetChain,
            payload.length,
            gasLimit
        );

        bytes memory vaaPayload = abi.encode(
            messageId,
            msg.sender,
            target,
            payload
        );
        
        // Send payload to target chain
        uint64 sequence = wormholeRelayer.sendPayloadToEvm{value: deliveryCost}(
            targetChain,
            target,
            vaaPayload,
            0,
            GAS_LIMIT
        );

        return keccak256(abi.encodePacked(sequence, targetChain));
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
        //return true;
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
     * @param deliveryHash Hash identifying the delivery
     */
    function markDeliveryCompleted(bytes32 deliveryHash) external {
        require(
            hasRole(RELAYER_ROLE, msg.sender),
            "MessageRouter: Must have relayer role"
        );

        routingStatus[deliveryHash] = true;

        // Using bytes32(0) since we don't have the messageId in this context
        // If messageId is needed, we would need to store it in a mapping when routing
        emit DeliveryCompleted(bytes32(0), deliveryHash);
        emit MessageDelivered(bytes32(0), deliveryHash, true);
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
