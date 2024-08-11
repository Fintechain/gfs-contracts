// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * @title IFeeManagement - Interface for fee management operations
 * @notice This contract manages the collection and distribution of fees in the DFN
 */
interface IFeeManagement {
    /**
     * @notice Emitted when a fee is collected
     * @param user The address of the user from whom the fee is collected
     * @param token The address of the token in which the fee is paid
     * @param amount The amount of fee collected
     */
    event FeeCollected(address indexed user, address indexed token, uint256 amount);

    /**
     * @notice Emitted when collected fees are distributed
     * @param recipient The address of the fee recipient
     * @param token The address of the token being distributed
     * @param amount The amount of tokens distributed
     */
    event FeeDistributed(address indexed recipient, address indexed token, uint256 amount);

    /**
     * @notice Collects a fee from a user
     * @param token The address of the token in which the fee is paid
     * @param amount The amount of fee to collect
     */
    function collectFee(address token, uint256 amount) external;

    /**
     * @notice Distributes collected fees to recipients
     * @param recipients The addresses of the fee recipients
     * @param shares The respective shares of each recipient
     */
    function distributeFees(address[] memory recipients, uint256[] memory shares) external;

    /**
     * @notice Sets a new fee rate
     * @param newRate The new fee rate to set
     */
    function setFeeRate(uint256 newRate) external;

    /**
     * @notice Retrieves the current fee rate
     * @return uint256 The current fee rate
     */
    function getCurrentFeeRate() external view returns (uint256);
}