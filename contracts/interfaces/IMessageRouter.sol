// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../lib/wormhole-solidity-sdk/src/WormholeRelayerSDK.sol";

interface IMessageRouter {
    /// @notice Routing result of a message
    struct RoutingResult {
        bytes32 messageId;
        bool success;
        bytes32 deliveryHash;
        uint256 timestamp;
    }

    /// @notice Emitted when a message is routed
    event MessageRouted(
        bytes32 indexed messageId,
        address indexed sender,
        address indexed target,
        uint16 targetChain,
        bytes32 deliveryHash
    );

    /// @notice Emitted when message delivery is confirmed
    event MessageDelivered(
        bytes32 indexed messageId,
        bytes32 indexed deliveryHash,
        bool success
    );

    /// @notice Emitted when a delivery is completed
    event DeliveryCompleted(
        bytes32 indexed messageId,
        bytes32 indexed deliveryHash
    );

    /// @notice Emitted when chain gas limit is updated
    event ChainGasLimitUpdated(uint16 indexed chainId, uint256 gasLimit);

    /// @notice Emitted when cross-chain fee parameters are updated
    event CrossChainFeesUpdated(
        uint256 baseFee,
        uint256 feeMultiplier
    );

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
    ) external payable returns (RoutingResult memory);

    /**
     * @notice Calculate total routing fee for a message
     * @param targetChain Target chain ID
     * @param payloadSize Size of the message payload
     * @return fee Required fee for routing
     */
    function quoteRoutingFee(
        uint16 targetChain,
        uint256 payloadSize
    ) external view returns (uint256);

    /**
     * @notice Calculate fee for local message routing
     * @param payloadSize Size of the message payload
     * @return fee Required fee for local routing
     */
    function calculateLocalRoutingFee(
        uint256 payloadSize
    ) external view returns (uint256);

    /**
     * @notice Calculate processing fee for cross-chain message routing
     * @param payloadSize Size of the message payload
     * @return fee Required processing fee for cross-chain routing
     */
    function calculateCrossChainProcessingFee(
        uint256 payloadSize
    ) external view returns (uint256);

    /**
     * @notice Get the delivery status of a routed message
     * @param deliveryHash Hash identifying the delivery
     * @return status Current delivery status
     */
    function getDeliveryStatus(
        bytes32 deliveryHash
    ) external view returns (bool);

    /**
     * @notice Verify if a message can be routed to a target
     * @param target Target address
     * @param targetChain Target chain ID
     * @return canRoute Whether message can be routed
     */
    function canRouteToTarget(
        address target,
        uint16 targetChain
    ) external view returns (bool);

    /**
     * @notice Mark a delivery as completed
     * @param deliveryHash Hash identifying the delivery
     */
    function markDeliveryCompleted(
        bytes32 deliveryHash
    ) external;

    /**
     * @notice Set gas limit for a specific chain
     * @param chainId Chain ID to set gas limit for
     * @param gasLimit New gas limit value
     */
    function setChainGasLimit(uint16 chainId, uint256 gasLimit) external;

    /**
     * @notice Update cross-chain fee parameters
     * @param baseFee New base fee for cross-chain messages
     * @param feeMultiplier New fee multiplier for cross-chain messages
     */
    function setCrossChainFeeParameters(
        uint256 baseFee,
        uint256 feeMultiplier
    ) external;

    /**
     * @notice Withdraw accumulated fees
     */
    function withdrawFees() external;
}