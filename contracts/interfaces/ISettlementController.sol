// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../lib/wormhole-solidity-sdk/src/WormholeRelayerSDK.sol";


/**
 * @title ISettlementController
 * @notice Interface for managing cross-chain settlements and token transfers
 * using Wormhole's TokenBridge
 */
interface ISettlementController {
    /// @notice Status of a settlement
    enum SettlementStatus {
        PENDING,
        IN_PROGRESS,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    /// @notice Settlement instruction details
    struct Settlement {
        bytes32 settlementId;
        bytes32 messageId;        // Related ISO20022 message
        address sourceToken;      // Token address on source chain
        address targetToken;      // Token address on target chain
        uint256 amount;          // Settlement amount
        uint16 sourceChain;      // Source chain ID
        uint16 targetChain;      // Target chain ID
        address sender;          // Settlement initiator
        address recipient;       // Settlement recipient
        SettlementStatus status; // Current status
        uint256 timestamp;      // Settlement initiation time
    }

    /// @notice Emitted when new settlement is created
    event SettlementCreated(
        bytes32 indexed settlementId,
        bytes32 indexed messageId,
        uint256 amount
    );

    /// @notice Emitted when settlement status changes
    event SettlementStatusUpdated(
        bytes32 indexed settlementId,
        SettlementStatus newStatus
    );

    /**
     * @notice Initiate a new settlement
     * @param messageId Associated message ID
     * @param sourceToken Source token address
     * @param targetToken Target token address
     * @param amount Amount to settle
     * @param targetChain Target chain ID
     * @param recipient Recipient address
     * @return settlementId Unique settlement identifier
     */
    function initiateSettlement(
        bytes32 messageId,
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint16 targetChain,
        address recipient
    ) external payable returns (bytes32 settlementId);

    /**
     * @notice Calculate fees for settlement
     * @param targetChain Target chain ID
     * @param amount Settlement amount
     * @return fee Total fee required
     */
    function quoteSettlementFee(
        uint16 targetChain,
        uint256 amount
    ) external view returns (uint256);

    /**
     * @notice Process incoming settlement from another chain
     * @param settlementData Encoded settlement data
     * @param sourceChain Source chain ID
     */
    function processIncomingSettlement(
        bytes calldata settlementData,
        uint16 sourceChain
    ) external;

    /**
     * @notice Cancel a pending settlement
     * @param settlementId Settlement to cancel
     * @return success Whether cancellation was successful
     */
    function cancelSettlement(
        bytes32 settlementId
    ) external returns (bool);

    /**
     * @notice Get settlement details
     * @param settlementId Settlement identifier
     * @return settlement Settlement details
     */
    function getSettlement(
        bytes32 settlementId
    ) external view returns (Settlement memory);

    /**
     * @notice Get all settlements for a message
     * @param messageId Message identifier
     * @return settlementIds Array of settlement IDs
     */
    function getSettlementsByMessage(
        bytes32 messageId
    ) external view returns (bytes32[] memory);
}