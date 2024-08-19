pragma solidity ^0.8.0;

/**
 * @title ICollateralManager
 * @dev Interface for managing collateral in the RTGS system.
 */
interface ICollateralManager {

    /**
     * @dev Deposits collateral for a specific asset type.
     * @param assetType The identifier for the asset type.
     * @param amount The amount of collateral to deposit.
     */
    function depositCollateral(bytes32 assetType, uint256 amount) external;

    /**
     * @dev Withdraws collateral for a specific asset type.
     * @param assetType The identifier for the asset type.
     * @param amount The amount of collateral to withdraw.
     */
    function withdrawCollateral(bytes32 assetType, uint256 amount) external;

    /**
     * @dev Updates the value of collateral for a specific owner and asset type.
     * @param owner The address of the collateral owner.
     * @param assetType The identifier for the asset type.
     * @param newValue The new value of the collateral.
     */
    function updateCollateralValue(address owner, bytes32 assetType, uint256 newValue) external;

    /**
     * @dev Retrieves the value of collateral for a specific owner and asset type.
     * @param owner The address of the collateral owner.
     * @param assetType The identifier for the asset type.
     * @return The value of the collateral.
     */
    function getCollateralValue(address owner, bytes32 assetType) external view returns (uint256);
}
