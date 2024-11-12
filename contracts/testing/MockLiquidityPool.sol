// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/ILiquidityPool.sol";
import "../../lib/wormhole-solidity-sdk/src/interfaces/token/IERC20.sol";



/**
 * @title MockLiquidityPool
 * @notice Mock implementation of liquidity pool for testing
 * @dev Simulates liquidity pool operations with tracking for testing
 */
contract MockLiquidityPool is ILiquidityPool {
    // Storage for pool information
    mapping(address => PoolInfo) private pools;
    mapping(address => mapping(address => uint256)) private providerShares;
    mapping(bytes32 => uint256) private lockedAmounts;
    TokenPair[] private supportedPairs;

    // Events for testing
    event LiquidityLocked(address token, uint256 amount, bytes32 settlementId);
    event LiquidityReleased(address token, uint256 amount, bytes32 settlementId);

    /**
     * @notice Add liquidity to pool
     * @param token Token address
     * @param amount Amount to add
     */
    function addLiquidity(
        address token,
        uint256 amount
    ) external override returns (uint256) {
        require(amount > 0, "MockLiquidityPool: Invalid amount");
        
        PoolInfo storage pool = pools[token];
        if (!pool.isActive) {
            pool.isActive = true;
            pool.minLiquidity = 0;
            pool.maxLiquidity = type(uint256).max;
        }

        // Transfer tokens
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        // Update pool info
        pool.totalLiquidity += amount;
        pool.availableLiquidity += amount;
        
        // Calculate and assign shares (1:1 for simplicity in mock)
        providerShares[token][msg.sender] += amount;
        
        emit LiquidityAdded(token, msg.sender, amount);
        return amount;
    }

    /**
     * @notice Remove liquidity from pool
     * @param token Token address
     * @param shares Shares to burn
     */
    function removeLiquidity(
        address token,
        uint256 shares
    ) external override returns (uint256) {
        require(shares > 0, "MockLiquidityPool: Invalid shares");
        require(
            providerShares[token][msg.sender] >= shares,
            "MockLiquidityPool: Insufficient shares"
        );
        
        PoolInfo storage pool = pools[token];
        require(pool.isActive, "MockLiquidityPool: Pool not active");
        require(
            pool.availableLiquidity >= shares,
            "MockLiquidityPool: Insufficient liquidity"
        );
        
        // Update pool info
        pool.totalLiquidity -= shares;
        pool.availableLiquidity -= shares;
        providerShares[token][msg.sender] -= shares;
        
        // Transfer tokens back
        IERC20(token).transfer(msg.sender, shares);
        
        emit LiquidityRemoved(token, msg.sender, shares);
        return shares;
    }

    /**
     * @notice Lock liquidity for settlement
     * @param token Token address
     * @param amount Amount to lock
     * @param settlementId Settlement identifier
     */
    function lockLiquidity(
        address token,
        uint256 amount,
        bytes32 settlementId
    ) external override {
        PoolInfo storage pool = pools[token];
        require(pool.isActive, "MockLiquidityPool: Pool not active");
        require(
            pool.availableLiquidity >= amount,
            "MockLiquidityPool: Insufficient liquidity"
        );
        
        pool.availableLiquidity -= amount;
        pool.lockedLiquidity += amount;
        lockedAmounts[settlementId] = amount;
        
        emit LiquidityLocked(token, amount, settlementId);
    }

    /**
     * @notice Release locked liquidity
     * @param token Token address
     * @param amount Amount to release
     * @param settlementId Settlement identifier
     */
    function releaseLiquidity(
        address token,
        uint256 amount,
        bytes32 settlementId
    ) external override {
        require(
            lockedAmounts[settlementId] >= amount,
            "MockLiquidityPool: Invalid locked amount"
        );
        
        PoolInfo storage pool = pools[token];
        pool.lockedLiquidity -= amount;
        pool.availableLiquidity += amount;
        lockedAmounts[settlementId] -= amount;
        
        emit LiquidityReleased(token, amount, settlementId);
    }

    /**
     * @notice Check if pool has sufficient liquidity
     * @param token Token address
     * @param amount Required amount
     */
    function hasAvailableLiquidity(
        address token,
        uint256 amount
    ) external view override returns (bool) {
        return pools[token].availableLiquidity >= amount;
    }

    /**
     * @notice Get pool information
     * @param token Token address
     */
    function getPoolInfo(
        address token
    ) external view override returns (PoolInfo memory) {
        return pools[token];
    }

    /**
     * @notice Get supported token pairs
     */
    function getSupportedPairs() external view override returns (TokenPair[] memory) {
        return supportedPairs;
    }

    // Testing helpers

    /**
     * @notice Add supported token pair for testing
     * @param sourceToken Source token address
     * @param targetToken Target token address
     * @param sourceChain Source chain ID
     * @param targetChain Target chain ID
     */
    function addSupportedPair(
        address sourceToken,
        address targetToken,
        uint16 sourceChain,
        uint16 targetChain
    ) external {
        supportedPairs.push(TokenPair({
            sourceToken: sourceToken,
            targetToken: targetToken,
            sourceChain: sourceChain,
            targetChain: targetChain,
            isSupported: true
        }));
    }

    /**
     * @notice Set pool status for testing
     * @param token Token address
     * @param isActive New active status
     */
    function setPoolStatus(address token, bool isActive) external {
        pools[token].isActive = isActive;
    }

    /**
     * @notice Get locked amount for testing
     * @param settlementId Settlement identifier
     */
    function getLockedAmount(bytes32 settlementId) external view returns (uint256) {
        return lockedAmounts[settlementId];
    }

    /**
     * @notice Get provider shares for testing
     * @param token Token address
     * @param provider Provider address
     */
    function getProviderShares(address token, address provider) external view returns (uint256) {
        return providerShares[token][provider];
    }
}