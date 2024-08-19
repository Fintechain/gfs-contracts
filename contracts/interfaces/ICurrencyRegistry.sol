pragma solidity ^0.8.0;

/**
 * @title ICurrencyRegistry
 * @dev Interface for managing currency information in the RTGS system.
 */
interface ICurrencyRegistry {

    /**
     * @dev Structure representing the details of a currency.
     * @param name The name of the currency.
     * @param decimals The number of decimal places the currency supports.
     * @param active Indicates whether the currency is active or not.
     */
    struct Currency {
        string name;
        uint8 decimals;
        bool active;
    }

    /**
     * @dev Adds a new currency to the registry.
     * @param currencyCode The unique identifier for the currency.
     * @param name The name of the currency.
     * @param decimals The number of decimal places the currency supports.
     */
    function addCurrency(bytes32 currencyCode, string memory name, uint8 decimals) external;

    /**
     * @dev Updates the active status of a currency.
     * @param currencyCode The unique identifier for the currency.
     * @param active The new active status of the currency.
     */
    function updateCurrencyStatus(bytes32 currencyCode, bool active) external;

    /**
     * @dev Retrieves the details of a specific currency.
     * @param currencyCode The unique identifier for the currency.
     * @return The currency's details as a `Currency` struct.
     */
    function getCurrency(bytes32 currencyCode) external view returns (Currency memory);

    /**
     * @dev Returns the total number of currencies registered.
     * @return The number of currencies in the registry.
     */
    function getCurrencyCount() external view returns (uint256);
}
