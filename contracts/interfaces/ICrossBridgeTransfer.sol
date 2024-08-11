// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * @title ICrossBridgeTransfer - Interface for cross-chain asset transfers
 * @notice This contract facilitates asset transfers between different blockchain networks
 */
interface ICrossBridgeTransfer {
    /**
     * @notice Emitted when an asset is locked for cross-chain transfer
     * @param user The address of the user locking the asset
     * @param token The address of the token being locked
     * @param amount The amount of tokens locked
     * @param destinationChainId The ID of the destination chain
     */
    event AssetLocked(address indexed user, address indexed token, uint256 amount, uint256 destinationChainId);

    /**
     * @notice Emitted when an asset is unlocked after cross-chain transfer
     * @param user The address of the user receiving the unlocked asset
     * @param token The address of the token being unlocked
     * @param amount The amount of tokens unlocked
     * @param sourceChainId The ID of the source chain
     */
    event AssetUnlocked(address indexed user, address indexed token, uint256 amount, uint256 sourceChainId);

    /**
     * @notice Locks an asset for cross-chain transfer
     * @param token The address of the token to lock
     * @param amount The amount of tokens to lock
     * @param destinationChainId The ID of the destination chain
     */
    function lockAsset(address token, uint256 amount, uint256 destinationChainId) external;

    /**
     * @notice Unlocks an asset after cross-chain transfer
     * @param user The address of the user to receive the unlocked asset
     * @param token The address of the token to unlock
     * @param amount The amount of tokens to unlock
     * @param sourceChainId The ID of the source chain
     * @param proof The proof of the cross-chain transfer
     */
    function unlockAsset(address user, address token, uint256 amount, uint256 sourceChainId, bytes memory proof) external;

    /**
     * @notice Verifies a cross-chain transfer
     * @param sourceChainId The ID of the source chain
     * @param proof The proof of the cross-chain transfer
     * @return bool True if the transfer is valid, false otherwise
     */
    function verifyTransfer(uint256 sourceChainId, bytes memory proof) external view returns (bool);
}
