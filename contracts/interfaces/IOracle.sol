// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
/**
 * @title IOracle
 * @dev Interface for price oracle operations
 */
interface IOracle {
    /**
     * @dev Emitted when a price is updated
     * @param token Address of the token
     * @param price New price of the token
     */
    event PriceUpdated(address indexed token, uint256 price);

    /**
     * @dev Updates the price of a token
     * @param token Address of the token
     * @param price New price of the token
     */
    function updatePrice(address token, uint256 price) external;

    /**
     * @dev Gets the current price of a token
     * @param token Address of the token
     * @return Current price of the token
     */
    function getPrice(address token) external view returns (uint256);

    /**
     * @dev Gets the timestamp of the latest price update for a token
     * @param token Address of the token
     * @return Timestamp of the latest price update
     */
    function getLatestTimestamp(address token) external view returns (uint256);
}