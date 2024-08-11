// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
/**
 * @title IEscrow - Interface for escrow operations
 * @notice This contract manages escrow services for secure transactions
 */
interface IEscrow {
    /**
     * @notice Emitted when a new escrow is created
     * @param escrowId The unique identifier of the escrow
     * @param sender The address of the sender (depositor)
     * @param recipient The address of the recipient
     * @param token The address of the token in escrow
     * @param amount The amount of tokens in escrow
     */
    event EscrowCreated(bytes32 indexed escrowId, address indexed sender, address indexed recipient, address token, uint256 amount);

    /**
     * @notice Emitted when an escrow is released to the recipient
     * @param escrowId The unique identifier of the released escrow
     */
    event EscrowReleased(bytes32 indexed escrowId);

    /**
     * @notice Emitted when an escrow is refunded to the sender
     * @param escrowId The unique identifier of the refunded escrow
     */
    event EscrowRefunded(bytes32 indexed escrowId);

    /**
     * @notice Creates a new escrow
     * @param recipient The address of the recipient
     * @param token The address of the token to be held in escrow
     * @param amount The amount of tokens to be held in escrow
     * @param duration The duration of the escrow in seconds
     * @return bytes32 The unique identifier of the created escrow
     */
    function createEscrow(address recipient, address token, uint256 amount, uint256 duration) external returns (bytes32);

    /**
     * @notice Releases the escrow to the recipient
     * @param escrowId The unique identifier of the escrow to release
     */
    function releaseEscrow(bytes32 escrowId) external;

    /**
     * @notice Refunds the escrow to the sender
     * @param escrowId The unique identifier of the escrow to refund
     */
    function refundEscrow(bytes32 escrowId) external;

    /**
     * @notice Retrieves the details of an escrow
     * @param escrowId The unique identifier of the escrow to query
     * @return sender The address of the sender
     * @return recipient The address of the recipient
     * @return token The address of the token in escrow
     * @return amount The amount of tokens in escrow
     * @return releaseTime The timestamp when the escrow can be released
     * @return released Whether the escrow has been released or refunded
     */
    function getEscrowDetails(bytes32 escrowId) external view returns (address sender, address recipient, address token, uint256 amount, uint256 releaseTime, bool released);
}
