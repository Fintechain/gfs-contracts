// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ILiquidityPool
 * @notice Interface for managing liquidity pools used in settlements
 */
interface ILiquidityPool {
    /// @notice Pool status information
    struct PoolInfo {
        uint256 totalLiquidity;
        uint256 availableLiquidity;
        uint256 lockedLiquidity;
        uint256 minLiquidity;
        uint256 maxLiquidity;
        bool isActive;
    }

    /// @notice Emitted when liquidity is added
    event LiquidityAdded(
        address indexed token,
        address indexed provider,
        uint256 amount
    );

    /// @notice Emitted when liquidity is removed
    event LiquidityRemoved(
        address indexed token,
        address indexed provider,
        uint256 amount
    );

    /// @notice Emitted when a new pool is created
    event PoolCreated(
        address indexed token, 
        uint256 minLiquidity, 
        uint256 maxLiquidity
    );

    /// @notice Emitted when pool parameters are updated
    event PoolUpdated(
        address indexed token, 
        uint256 minLiquidity, 
        uint256 maxLiquidity
    );

    /// @notice Emitted when liquidity is locked for settlement
    event LiquidityLocked(
        address indexed token, 
        bytes32 indexed settlementId, 
        uint256 amount
    );

    // Events
    event EmergencyWithdraw(address indexed token, uint256 amount);

    event LiquidityUnlocked(
        address indexed token,
        bytes32 indexed settlementId,
        uint256 amount
    );

    /// @notice Emitted when locked liquidity is released
    event LiquidityReleased(
        address indexed token, 
        bytes32 indexed settlementId, 
        uint256 amount
    );

    /// @notice Emitted when a settlement is completed
    event SettlementCompleted(
        bytes32 indexed settlementId,
        uint256 amount,
        address recipient
    );

    /// @notice Emitted when provider blacklist status is updated
    event ProviderBlacklistUpdated(
        address indexed provider,
        bool blacklisted
    );

    /// @notice Emitted when permissionless liquidity setting is updated
    event PermissionlessLiquiditySet(bool enabled);

    /**
     * @notice Set blacklist status for a liquidity provider
     * @param provider Address of the provider
     * @param blacklisted Whether the provider should be blacklisted
     */
    function setProviderBlacklist(
        address provider,
        bool blacklisted
    ) external;

    /**
     * @notice Toggle permissionless liquidity provision
     * @param _permissionless Whether permissionless liquidity should be enabled
     */
    function setPermissionlessLiquidity(bool _permissionless) external;

    /**
     * @notice Add liquidity to pool
     * @param token Token address
     * @param amount Amount to add
     * @return shares Liquidity shares issued
     */
    function addLiquidity(
        address token,
        uint256 amount
    ) external returns (uint256 shares);

    /**
     * @notice Remove liquidity from pool
     * @param token Token address
     * @param shares Shares to burn
     * @return amount Amount of tokens returned
     */
    function removeLiquidity(
        address token,
        uint256 shares
    ) external returns (uint256 amount);

    /**
     * @notice Lock liquidity for settlement
     * @param token Token address
     * @param amount Amount to lock
     * @param settlementId Associated settlement ID
     */
    function lockLiquidity(
        address token,
        uint256 amount,
        bytes32 settlementId
    ) external;

    /**
     * @notice Initiate a settlement and execute the token transfer
     * @param settlementId Unique identifier for the settlement
     * @param token Token address
     * @param amount Amount to be settled
     * @param recipient Recipient address for the settlement
     */
    function initiateSettlement(
        bytes32 settlementId,
        address token,
        uint256 amount,
        address recipient
    ) external;

    /**
     * @notice Check if pool has sufficient liquidity
     * @param token Token address
     * @param amount Required amount
     * @return isAvailable Whether liquidity is available
     */
    function hasAvailableLiquidity(
        address token,
        uint256 amount
    ) external view returns (bool);

    /**
     * @notice Get pool information for token
     * @param token Token address
     * @return info Pool information
     */
    function getPoolInfo(
        address token
    ) external view returns (PoolInfo memory);
}