// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/ILiquidityPool.sol";

/**
 * @title LiquidityPool
 * @notice Manages liquidity pools for settlements
 */
contract LiquidityPool is ILiquidityPool, AccessControl, Pausable, ReentrancyGuard {
    // Role definitions
    bytes32 public constant LIQUIDITY_PROVIDER_ROLE = keccak256("LIQUIDITY_PROVIDER_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");

    // State variables
    mapping(address => PoolInfo) private pools;
    mapping(bytes32 => uint256) private lockedAmounts;
    mapping(address => mapping(address => uint256)) private providerShares;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LIQUIDITY_PROVIDER_ROLE, msg.sender);
        _grantRole(SETTLEMENT_ROLE, msg.sender);
    }

    /**
     * @notice Add liquidity to pool
     * @param token Token address
     * @param amount Amount to add
     * @return shares Liquidity shares issued
     */
    function addLiquidity(
        address token,
        uint256 amount
    ) external override whenNotPaused nonReentrant returns (uint256 shares) {
        require(
            hasRole(LIQUIDITY_PROVIDER_ROLE, msg.sender),
            "LiquidityPool: Must have provider role"
        );
        require(amount > 0, "LiquidityPool: Invalid amount");
        require(pools[token].isActive, "LiquidityPool: Pool not active");

        PoolInfo storage pool = pools[token];
        require(
            pool.totalLiquidity + amount <= pool.maxLiquidity,
            "LiquidityPool: Exceeds max liquidity"
        );

        // Calculate shares
        shares = pool.totalLiquidity == 0 ? 
            amount : (amount * _totalShares(token)) / pool.totalLiquidity;
        
        require(shares > 0, "LiquidityPool: Zero shares");

        // Transfer tokens
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Update state
        providerShares[token][msg.sender] += shares;
        pool.totalLiquidity += amount;
        pool.availableLiquidity += amount;

        emit LiquidityAdded(token, msg.sender, amount);
        return shares;
    }

    /**
     * @notice Remove liquidity from pool
     * @param token Token address
     * @param shares Shares to burn
     * @return amount Amount of tokens returned
     */
    function removeLiquidity(
        address token,
        uint256 shares
    ) external override whenNotPaused nonReentrant returns (uint256 amount) {
        require(shares > 0, "LiquidityPool: Invalid shares");
        require(
            providerShares[token][msg.sender] >= shares,
            "LiquidityPool: Insufficient shares"
        );

        PoolInfo storage pool = pools[token];
        
        // Calculate amount
        amount = (shares * pool.totalLiquidity) / _totalShares(token);
        require(
            pool.availableLiquidity >= amount,
            "LiquidityPool: Insufficient available liquidity"
        );
        require(
            pool.totalLiquidity - amount >= pool.minLiquidity,
            "LiquidityPool: Below min liquidity"
        );

        // Update state
        providerShares[token][msg.sender] -= shares;
        pool.totalLiquidity -= amount;
        pool.availableLiquidity -= amount;

        // Transfer tokens
        IERC20(token).transfer(msg.sender, amount);

        emit LiquidityRemoved(token, msg.sender, amount);
        return amount;
    }

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
    ) external override whenNotPaused {
        require(
            hasRole(SETTLEMENT_ROLE, msg.sender),
            "LiquidityPool: Must have settlement role"
        );
        _lockLiquidity(token, amount, settlementId);
    }

    /**
     * @notice Initiate a settlement and execute the token transfer
     */
    function initiateSettlement(
        bytes32 settlementId,
        address token,
        uint256 amount,
        address recipient
    ) external override whenNotPaused {
        require(
            hasRole(SETTLEMENT_ROLE, msg.sender),
            "LiquidityPool: Must have settlement role"
        );
        require(amount > 0, "LiquidityPool: Invalid amount");

        require(_hasAvailableLiquidity(token, amount), "Insufficient liquidity");

        _lockLiquidity(token, amount, settlementId);

        IERC20(token).transfer(recipient, amount);

        emit SettlementCompleted(settlementId, amount, recipient);
    }

    /**
     * @notice Check if pool has sufficient liquidity
     */
    function hasAvailableLiquidity(
        address token,
        uint256 amount
    ) external view override returns (bool) {
        return _hasAvailableLiquidity(token, amount);
    }

    /**
     * @notice Get pool information for token
     */
    function getPoolInfo(
        address token
    ) external view override returns (PoolInfo memory) {
        return pools[token];
    }

    /**
     * @notice Create new liquidity pool
     * @param token Token address
     * @param minLiquidity Minimum liquidity requirement
     * @param maxLiquidity Maximum liquidity limit
     */
    function createPool(
        address token,
        uint256 minLiquidity,
        uint256 maxLiquidity
    ) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "LiquidityPool: Must have admin role"
        );
        require(
            !pools[token].isActive,
            "LiquidityPool: Pool already exists"
        );
        require(
            minLiquidity <= maxLiquidity,
            "LiquidityPool: Invalid limits"
        );

        pools[token] = PoolInfo({
            totalLiquidity: 0,
            availableLiquidity: 0,
            lockedLiquidity: 0,
            minLiquidity: minLiquidity,
            maxLiquidity: maxLiquidity,
            isActive: true
        });

        emit PoolCreated(token, minLiquidity, maxLiquidity);
    }

    /**
     * @notice Internal function for checking available liquidity
     */
    function _hasAvailableLiquidity(
        address token,
        uint256 amount
    ) internal view returns (bool) {
        PoolInfo storage pool = pools[token];
        return pool.isActive && pool.availableLiquidity >= amount;
    }

    /**
     * @notice Internal function for locking liquidity
     */
    function _lockLiquidity(
        address token,
        uint256 amount,
        bytes32 settlementId
    ) internal {
        require(amount > 0, "LiquidityPool: Invalid amount");
        require(
            lockedAmounts[settlementId] == 0,
            "LiquidityPool: Already locked"
        );

        PoolInfo storage pool = pools[token];
        require(pool.isActive, "LiquidityPool: Pool not active");
        require(
            pool.availableLiquidity >= amount,
            "LiquidityPool: Insufficient liquidity"
        );

        pool.availableLiquidity -= amount;
        pool.lockedLiquidity += amount;
        lockedAmounts[settlementId] = amount;

        emit LiquidityLocked(token, settlementId, amount);
    }

    /**
     * @notice Get total shares for a token
     */
    function _totalShares(address token) internal view returns (uint256) {
        uint256 total = 0;
        // This could be optimized by tracking total shares in storage
        for (uint256 i = 0; i < 10; i++) {
            // Limit iteration to prevent DoS
            if (providerShares[token][msg.sender] > 0) {
                total += providerShares[token][msg.sender];
            }
        }
        return total;
    }

    /**
     * @notice Pause the pool
     */
    function pause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "LiquidityPool: Must have admin role"
        );
        _pause();
    }

    /**
     * @notice Unpause the pool
     */
    function unpause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "LiquidityPool: Must have admin role"
        );
        _unpause();
    }
}