// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * @title ILiquidityPool
 * @dev Interface for managing liquidity pools and swaps
 */
interface ILiquidityPool {
    /**
     * @dev Emitted when liquidity is added to a pool
     * @param provider Address of the liquidity provider
     * @param tokenA Address of the first token in the pair
     * @param tokenB Address of the second token in the pair
     * @param amountA Amount of tokenA added
     * @param amountB Amount of tokenB added
     */
    event LiquidityAdded(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB);

    /**
     * @dev Emitted when liquidity is removed from a pool
     * @param provider Address of the liquidity provider
     * @param tokenA Address of the first token in the pair
     * @param tokenB Address of the second token in the pair
     * @param amountA Amount of tokenA removed
     * @param amountB Amount of tokenB removed
     */
    event LiquidityRemoved(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB);

    /**
     * @dev Emitted when a swap occurs
     * @param user Address of the user performing the swap
     * @param tokenIn Address of the input token
     * @param tokenOut Address of the output token
     * @param amountIn Amount of input tokens
     * @param amountOut Amount of output tokens
     */
    event Swap(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    /**
     * @dev Adds liquidity to a pool
     * @param tokenA Address of the first token in the pair
     * @param tokenB Address of the second token in the pair
     * @param amountADesired Desired amount of tokenA to add
     * @param amountBDesired Desired amount of tokenB to add
     * @param amountAMin Minimum amount of tokenA to add
     * @param amountBMin Minimum amount of tokenB to add
     * @return amountA Actual amount of tokenA added
     * @return amountB Actual amount of tokenB added
     */
    function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin) external returns (uint256 amountA, uint256 amountB);

    /**
     * @dev Removes liquidity from a pool
     * @param tokenA Address of the first token in the pair
     * @param tokenB Address of the second token in the pair
     * @param liquidity Amount of liquidity tokens to burn
     * @param amountAMin Minimum amount of tokenA to receive
     * @param amountBMin Minimum amount of tokenB to receive
     * @return amountA Actual amount of tokenA received
     * @return amountB Actual amount of tokenB received
     */
    function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin) external returns (uint256 amountA, uint256 amountB);

    /**
     * @dev Swaps tokens
     * @param tokenIn Address of the input token
     * @param tokenOut Address of the output token
     * @param amountIn Amount of input tokens
     * @param amountOutMin Minimum amount of output tokens to receive
     * @return amountOut Actual amount of output tokens received
     */
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) external returns (uint256 amountOut);

    /**
     * @dev Gets the current reserves of a pair
     * @param tokenA Address of the first token in the pair
     * @param tokenB Address of the second token in the pair
     * @return reserveA Current reserve of tokenA
     * @return reserveB Current reserve of tokenB
     */
    function getReserves(address tokenA, address tokenB) external view returns (uint256 reserveA, uint256 reserveB);
}
