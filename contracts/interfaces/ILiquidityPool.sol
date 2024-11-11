// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ILiquidityPool
 * @notice Interface for managing liquidity pools used in cross-chain settlements
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

    /// @notice Token pair for cross-chain settlement
    struct TokenPair {
        address sourceToken;
        address targetToken;
        uint16 sourceChain;
        uint16 targetChain;
        bool isSupported;
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
     * @notice Release locked liquidity
     * @param token Token address
     * @param amount Amount to release
     * @param settlementId Associated settlement ID
     */
    function releaseLiquidity(
        address token,
        uint256 amount,
        bytes32 settlementId
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

    /**
     * @notice Get supported token pairs
     * @return pairs Array of supported token pairs
     */
    function getSupportedPairs() external view returns (TokenPair[] memory);
}