// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * @title IMultiCurrencyWallet - Interface for multi-currency wallet operations
 * @notice This contract manages user balances across multiple currencies and tokens
 */
interface IMultiCurrencyWallet {
    /**
     * @notice Emitted when a deposit is made to the wallet
     * @param user The address of the user making the deposit
     * @param token The address of the deposited token
     * @param amount The amount of tokens deposited
     */
    event Deposit(address indexed user, address indexed token, uint256 amount);

    /**
     * @notice Emitted when a withdrawal is made from the wallet
     * @param user The address of the user making the withdrawal
     * @param token The address of the withdrawn token
     * @param amount The amount of tokens withdrawn
     */
    event Withdrawal(address indexed user, address indexed token, uint256 amount);

    /**
     * @notice Emitted when a transfer is made between users
     * @param from The address of the sender
     * @param to The address of the recipient
     * @param token The address of the transferred token
     * @param amount The amount of tokens transferred
     */
    event Transfer(address indexed from, address indexed to, address indexed token, uint256 amount);

    /**
     * @notice Deposits tokens into the user's wallet
     * @param token The address of the token to deposit
     * @param amount The amount of tokens to deposit
     */
    function deposit(address token, uint256 amount) external;

    /**
     * @notice Withdraws tokens from the user's wallet
     * @param token The address of the token to withdraw
     * @param amount The amount of tokens to withdraw
     */
    function withdraw(address token, uint256 amount) external;

    /**
     * @notice Transfers tokens from the sender to another user
     * @param to The address of the recipient
     * @param token The address of the token to transfer
     * @param amount The amount of tokens to transfer
     */
    function transfer(address to, address token, uint256 amount) external;

    /**
     * @notice Retrieves the balance of a specific token for a user
     * @param user The address of the user to query
     * @param token The address of the token to query
     * @return uint256 The balance of the specified token for the user
     */
    function balanceOf(address user, address token) external view returns (uint256);
}