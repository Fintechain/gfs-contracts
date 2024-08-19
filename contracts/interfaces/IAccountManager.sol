pragma solidity ^0.8.0;

/**
 * @title IBalanceAndLiquidityManager
 * @dev Interface for managing balances and liquidity within the RTGS system.
 */
interface IBalanceAndLiquidityManager {

    /**
     * @dev Creates an account for the specified currency.
     * @param currency The identifier for the currency.
     */
    function createAccount(bytes32 currency) external;

    /**
     * @dev Retrieves the balance of a specific account.
     * @param owner The address of the account owner.
     * @param currency The currency identifier for the balance.
     * @return The balance of the specified currency for the given owner.
     */
    function getBalance(address owner, bytes32 currency) external view returns (uint256);

    /**
     * @dev Updates the balance of a specific account.
     * @param owner The address of the account owner.
     * @param currency The currency identifier for the balance.
     * @param amount The amount to update the balance by.
     * @param isCredit Indicates whether the amount is to be added (credit) or subtracted (debit).
     */
    function updateBalance(address owner, bytes32 currency, uint256 amount, bool isCredit) external;

    /**
     * @dev Reserves liquidity for a specific account.
     * @param owner The address of the account owner.
     * @param currency The currency identifier for the liquidity.
     * @param amount The amount of liquidity to reserve.
     */
    function reserveLiquidity(address owner, bytes32 currency, uint256 amount) external;

    /**
     * @dev Releases reserved liquidity for a specific account.
     * @param owner The address of the account owner.
     * @param currency The currency identifier for the liquidity.
     * @param amount The amount of liquidity to release.
     */
    function releaseLiquidity(address owner, bytes32 currency, uint256 amount) external;

    /**
     * @dev Retrieves the available liquidity for a specific account.
     * @param owner The address of the account owner.
     * @param currency The currency identifier for the liquidity.
     * @return The available liquidity for the specified currency and owner.
     */
    function getAvailableLiquidity(address owner, bytes32 currency) external view returns (uint256);
}
