// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/ILiquidityPool.sol";

/**
 * @title LiquidityPool
 * @notice Manages liquidity pools for settlements with improved security
 */
contract LiquidityPool is
    ILiquidityPool,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // Role definitions
    bytes32 public constant LIQUIDITY_PROVIDER_ROLE =
        keccak256("LIQUIDITY_PROVIDER_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // Constants
    uint256 private constant WITHDRAWAL_COOLDOWN = 1 hours;

    // State variables
    bool public permissionlessLiquidity;

    mapping(address => PoolInfo) private pools;
    mapping(bytes32 => uint256) private lockedAmounts;
    mapping(address => bool) public blacklistedProviders;
    mapping(address => mapping(address => uint256)) private providerShares;
    mapping(address => uint256) private totalTokenShares;
    mapping(address => mapping(address => uint256)) private lastWithdrawalTime;
    mapping(bytes32 => address) private settlementTokens;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LIQUIDITY_PROVIDER_ROLE, msg.sender);
        _grantRole(SETTLEMENT_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }

    function setPermissionlessLiquidity(
        bool _permissionless
    ) external override {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "LiquidityPool: Must have admin role"
        );
        permissionlessLiquidity = _permissionless;
        emit PermissionlessLiquiditySet(_permissionless);
    }

    function setProviderBlacklist(
        address provider,
        bool blacklisted
    ) external override {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "LiquidityPool: Must have admin role"
        );
        require(
            provider != address(0),
            "LiquidityPool: Invalid provider address"
        );
        blacklistedProviders[provider] = blacklisted;
        emit ProviderBlacklistUpdated(provider, blacklisted);
    }

    function addLiquidity(
        address token,
        uint256 amount
    ) external override whenNotPaused nonReentrant returns (uint256 shares) {
        require(
            !blacklistedProviders[msg.sender],
            "LiquidityPool: Provider is blacklisted"
        );
        if (!permissionlessLiquidity) {
            require(
                hasRole(LIQUIDITY_PROVIDER_ROLE, msg.sender),
                "LiquidityPool: Must have provider role"
            );
        }
        require(amount > 0, "LiquidityPool: Invalid amount");
        require(pools[token].isActive, "LiquidityPool: Pool not active");

        PoolInfo storage pool = pools[token];
        require(
            pool.totalLiquidity + amount <= pool.maxLiquidity,
            "LiquidityPool: Exceeds max liquidity"
        );

        // Calculate shares with improved precision
        shares = _calculateShares(token, amount, pool.totalLiquidity);
        require(shares > 0, "LiquidityPool: Zero shares");

        // Transfer tokens first
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Update state
        providerShares[token][msg.sender] += shares;
        totalTokenShares[token] += shares;
        pool.totalLiquidity += amount;
        pool.availableLiquidity += amount;

        emit LiquidityAdded(token, msg.sender, amount);
        return shares;
    }

    function removeLiquidity(
        address token,
        uint256 shares
    ) external override whenNotPaused nonReentrant returns (uint256 amount) {
        require(shares > 0, "LiquidityPool: Invalid shares");
        require(
            providerShares[token][msg.sender] >= shares,
            "LiquidityPool: Insufficient shares"
        );
        require(
            block.timestamp >=
                lastWithdrawalTime[msg.sender][token] + WITHDRAWAL_COOLDOWN,
            "LiquidityPool: Withdrawal too soon"
        );

        PoolInfo storage pool = pools[token];

        // Calculate amount with improved precision
        amount = (shares * pool.totalLiquidity) / totalTokenShares[token];
        require(
            pool.availableLiquidity >= amount,
            "Insufficient available liquidity"
        );
        require(
            pool.totalLiquidity - amount >= pool.minLiquidity,
            "Below min liquidity"
        );

        // Update state before transfer
        providerShares[token][msg.sender] -= shares;
        totalTokenShares[token] -= shares;
        pool.totalLiquidity -= amount;
        pool.availableLiquidity -= amount;
        lastWithdrawalTime[msg.sender][token] = block.timestamp;

        // Transfer tokens
        IERC20(token).safeTransfer(msg.sender, amount);

        emit LiquidityRemoved(token, msg.sender, amount);
        return amount;
    }

    function lockLiquidity(
        address token,
        uint256 amount,
        bytes32 settlementId
    ) external override whenNotPaused {
        require(
            hasRole(SETTLEMENT_ROLE, msg.sender),
            "Must have settlement role"
        );
        _lockLiquidity(token, amount, settlementId);
    }

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
        require(recipient != address(0), "LiquidityPool: Invalid recipient");

        // Lock liquidity first
        _lockLiquidity(token, amount, settlementId);

        // Do the transfer before updating pool state for locked liquidity
        IERC20(token).safeTransfer(recipient, amount);

        // Update pool state to reflect the settlement
        PoolInfo storage pool = pools[token];
        pool.totalLiquidity -= amount; // Add this line
        pool.lockedLiquidity -= amount; // Release the locked liquidity immediately

        emit SettlementCompleted(settlementId, amount, recipient);
    }

    function _lockLiquidity(
        address token,
        uint256 amount,
        bytes32 settlementId
    ) internal {
        require(amount > 0, "Invalid amount");
        require(lockedAmounts[settlementId] == 0, "Already locked");

        PoolInfo storage pool = pools[token];
        require(pool.isActive, "Pool not active");
        require(pool.availableLiquidity >= amount, "Insufficient liquidity");

        pool.availableLiquidity -= amount;
        pool.lockedLiquidity += amount;
        lockedAmounts[settlementId] = amount;
        settlementTokens[settlementId] = token;

        emit LiquidityLocked(token, settlementId, amount);
    }

    function unlockLiquidity(bytes32 settlementId) public whenNotPaused {
        require(
            hasRole(SETTLEMENT_ROLE, msg.sender),
            "Must have settlement role"
        );

        uint256 amount = lockedAmounts[settlementId];
        require(amount > 0, "Nothing locked");

        address token = settlementTokens[settlementId];
        require(token != address(0), "Invalid settlement");

        PoolInfo storage pool = pools[token];
        pool.lockedLiquidity -= amount;
        pool.availableLiquidity += amount;
        delete lockedAmounts[settlementId];
        delete settlementTokens[settlementId];

        emit LiquidityUnlocked(token, settlementId, amount);
        emit LiquidityReleased(token, settlementId, amount);
    }

    function emergencyWithdraw(address token) external {
        require(
            hasRole(EMERGENCY_ROLE, msg.sender),
            "Must have emergency role"
        );
        require(paused(), "Must be paused");
        require(token != address(0), "Invalid token");

        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");

        IERC20(token).safeTransfer(msg.sender, balance);

        emit EmergencyWithdraw(token, balance);
    }

    function hasAvailableLiquidity(
        address token,
        uint256 amount
    ) external view override returns (bool) {
        return _hasAvailableLiquidity(token, amount);
    }

    function getPoolInfo(
        address token
    ) external view override returns (PoolInfo memory) {
        return pools[token];
    }

    function createPool(
        address token,
        uint256 minLiquidity,
        uint256 maxLiquidity
    ) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "LiquidityPool: Must have admin role"
        );
        require(token != address(0), "LiquidityPool: Invalid token");
        require(!pools[token].isActive, "LiquidityPool: Pool already exists");
        require(minLiquidity <= maxLiquidity, "LiquidityPool: Invalid limits");

        // Validate token implements ERC20
        try IERC20(token).totalSupply() returns (uint256) {
            // Token implements totalSupply
        } catch {
            revert("Invalid ERC20");
        }

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

    function updatePool(
        address token,
        uint256 minLiquidity,
        uint256 maxLiquidity
    ) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Must have admin role"
        );
        require(pools[token].isActive, "Pool does not exist");
        require(minLiquidity <= maxLiquidity, "Invalid limits");

        PoolInfo storage pool = pools[token];
        pool.minLiquidity = minLiquidity;
        pool.maxLiquidity = maxLiquidity;

        emit PoolUpdated(token, minLiquidity, maxLiquidity);
    }

    function _hasAvailableLiquidity(
        address token,
        uint256 amount
    ) internal view returns (bool) {
        PoolInfo storage pool = pools[token];

        // Additional diagnostic check
        uint256 actualBalance = IERC20(token).balanceOf(address(this));
        require(
            actualBalance >= pool.availableLiquidity,
            "Pool balance mismatch with recorded liquidity"
        );

        return pool.isActive && pool.availableLiquidity >= amount;
    }

    function _calculateShares(
        address token,
        uint256 amount,
        uint256 totalLiquidity
    ) internal view returns (uint256) {
        if (totalLiquidity == 0 || totalTokenShares[token] == 0) {
            return amount;
        }
        return (amount * totalTokenShares[token]) / totalLiquidity;
    }


    function pause() external {
        require(
            hasRole(EMERGENCY_ROLE, msg.sender),
            "Must have emergency role"
        );
        _pause();
    }

    function unpause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Must have admin role"
        );
        _unpause();
    }
}
