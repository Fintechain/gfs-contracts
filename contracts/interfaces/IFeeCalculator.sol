pragma solidity ^0.8.0;

/**
 * @title IFeeCalculator
 * @dev Interface for calculating fees in the RTGS system.
 */
interface IFeeCalculator {

    /**
     * @dev Sets the fee structure for a specific transaction type.
     * @param transactionType The identifier for the transaction type.
     * @param baseFee The base fee for the transaction type.
     * @param percentageFee The percentage fee for the transaction type.
     */
    function setFeeStructure(bytes32 transactionType, uint256 baseFee, uint256 percentageFee) external;

    /**
     * @dev Calculates the fee for a specific transaction.
     * @param transactionType The identifier for the transaction type.
     * @param transactionAmount The amount of the transaction.
     * @return The calculated fee for the transaction.
     */
    function calculateFee(bytes32 transactionType, uint256 transactionAmount) external view returns (uint256);
}
