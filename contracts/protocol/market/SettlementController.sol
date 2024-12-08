// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../interfaces/ISettlementController.sol";
import "../../interfaces/ILiquidityPool.sol";

/**
 * @title SettlementController
 * @notice Processes settlement instructions from message handlers
 */
contract SettlementController is
    ISettlementController,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    // Role for message handlers
    bytes32 public constant HANDLER_ROLE = keccak256("HANDLER_ROLE");

    // Dependencies
    ILiquidityPool public immutable liquidityPool;

    // Storage
    mapping(bytes32 => Settlement) private settlements;
    mapping(bytes32 => bytes32[]) private messageSettlements;
    mapping(bytes32 => bool) private processedSettlements;

    constructor(address _liquidityPool) {
        require(_liquidityPool != address(0), "Invalid liquidity pool");
        liquidityPool = ILiquidityPool(_liquidityPool);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Process settlement instruction from handler
     */
    function processSettlement(
        bytes32 messageId,
        address token,
        uint256 amount,
        address recipient
    ) external override whenNotPaused nonReentrant returns (bytes32) {
        require(hasRole(HANDLER_ROLE, msg.sender), "Only handlers");
        require(amount > 0, "Invalid amount");
        require(recipient != address(0), "Invalid recipient");

        bytes32 settlementId = _generateSettlementId(
            messageId,
            token,
            amount,
            recipient
        );

        require(!processedSettlements[settlementId], "Already processed");

        // Create settlement record
        settlements[settlementId] = Settlement({
            settlementId: settlementId,
            messageId: messageId,
            token: token,
            amount: amount,
            sender: msg.sender,
            recipient: recipient,
            status: SettlementStatus.IN_PROGRESS,
            timestamp: block.timestamp
        });

        messageSettlements[messageId].push(settlementId);

        // Initiate settlement with the LiquidityPool
        try
            liquidityPool.initiateSettlement(
                settlementId,
                token,
                amount,
                recipient
            )
        {
            settlements[settlementId].status = SettlementStatus.COMPLETED;
            processedSettlements[settlementId] = true;
            emit SettlementStatusUpdated(
                settlementId,
                SettlementStatus.COMPLETED
            );
            emit SettlementProcessed(
                settlementId,
                messageId,
                amount,
                recipient
            );
        } catch {
            settlements[settlementId].status = SettlementStatus.FAILED;
            emit SettlementStatusUpdated(settlementId, SettlementStatus.FAILED);
        }

        return settlementId;
    }

    /**
     * @notice Generate unique settlement ID
     */
    function _generateSettlementId(
        bytes32 messageId,
        address token,
        uint256 amount,
        address recipient
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    messageId,
                    token,
                    amount,
                    recipient,
                    block.timestamp
                )
            );
    }

    // View functions implementation
    function getSettlement(
        bytes32 settlementId
    ) external view override returns (Settlement memory) {
        return settlements[settlementId];
    }

    function getSettlementsByMessage(
        bytes32 messageId
    ) external view override returns (bytes32[] memory) {
        return messageSettlements[messageId];
    }

    // Admin functions
    function pause() external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Only admin");
        _pause();
    }

    function unpause() external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Only admin");
        _unpause();
    }
}
