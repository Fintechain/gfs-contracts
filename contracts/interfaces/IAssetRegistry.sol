// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * @title IAssetRegistry - Interface for managing asset registration
 * @notice This contract handles the registration and tracking of various assets in the DFN
 */
interface IAssetRegistry {
    /**
     * @notice Emitted when a new asset is registered
     * @param token The address of the registered token
     * @param name The name of the registered token
     * @param decimals The number of decimals for the token
     */
    event AssetRegistered(address indexed token, string name, uint8 decimals);

    /**
     * @notice Emitted when an asset is deactivated
     * @param token The address of the deactivated token
     */
    event AssetDeactivated(address indexed token);

    /**
     * @notice Registers a new asset in the system
     * @param token The address of the token to register
     * @param name The name of the token
     * @param decimals The number of decimals for the token
     */
    function registerAsset(address token, string memory name, uint8 decimals) external;

    /**
     * @notice Deactivates an asset in the system
     * @param token The address of the token to deactivate
     */
    function deactivateAsset(address token) external;

    /**
     * @notice Checks if an asset is active in the system
     * @param token The address of the token to check
     * @return bool True if the asset is active, false otherwise
     */
    function isActiveAsset(address token) external view returns (bool);

    /**
     * @notice Retrieves the details of an asset
     * @param token The address of the token to query
     * @return name The name of the token
     * @return decimals The number of decimals for the token
     * @return active Whether the token is currently active
     */
    function getAssetDetails(address token) external view returns (string memory name, uint8 decimals, bool active);
}