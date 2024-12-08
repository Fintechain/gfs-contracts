// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/ILiquidityPool.sol";

/**
 * @title MockLiquidityPool
 * @notice Mock implementation of ILiquidityPool for testing
 */
contract MockLiquidityPool is ILiquidityPool {
    bool public permissionlessMode;
    mapping(address => bool) public blacklistedProviders;

    function addLiquidity(
        address token,
        uint256 amount
    ) external override returns (uint256) {
        emit LiquidityAdded(token, msg.sender, amount);
        return amount;
    }

    function removeLiquidity(
        address token,
        uint256 shares
    ) external override returns (uint256) {
        emit LiquidityRemoved(token, msg.sender, shares);
        return shares;
    }

    function lockLiquidity(
        address token,
        uint256 amount,
        bytes32 settlementId
    ) external override {
        emit LiquidityLocked(token, settlementId, amount);
    }

    function initiateSettlement(
        bytes32 settlementId,
        address token,
        uint256 amount,
        address recipient
    ) external override {
        emit SettlementCompleted(settlementId, amount, recipient);
    }

    function hasAvailableLiquidity(
        address token,
        uint256 amount
    ) external pure override returns (bool) {
        return true;
    }

    function getPoolInfo(
        address token
    ) external pure override returns (PoolInfo memory) {
        return PoolInfo(0, 0, 0, 0, 0, true);
    }

    function setPermissionlessLiquidity(bool enabled) external override {
        permissionlessMode = enabled;
        emit PermissionlessLiquiditySet(enabled);
    }

    function setProviderBlacklist(address provider, bool blacklisted) external override {
        blacklistedProviders[provider] = blacklisted;
        emit ProviderBlacklistUpdated(provider, blacklisted);
    }

    // Helper functions for testing
    function isPermissionlessEnabled() external view returns (bool) {
        return permissionlessMode;
    }

    function isBlacklisted(address provider) external view returns (bool) {
        return blacklistedProviders[provider];
    }

    // Mock functions to simulate failures for testing
    function mockSetBlacklistRevert() external pure {
        revert("MockLiquidityPool: Blacklist operation failed");
    }

    function mockSetPermissionlessRevert() external pure {
        revert("MockLiquidityPool: Permissionless setting failed");
    }
}