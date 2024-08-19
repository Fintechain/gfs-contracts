pragma solidity ^0.8.0;

/**
 * @title ITransactionManager
 * @dev Interface for managing transactions in the decentralized RTGS system.
 */
interface ITransactionManager {
    
    /**
     * @dev Enumeration representing the status of a transaction.
     */
    enum TransactionStatus { Pending, Queued, Settled, Failed }

    /**
     * @dev Structure representing a transaction's details.
     * @param id The unique identifier of the transaction.
     * @param from The address initiating the transaction.
     * @param to The address receiving the transaction.
     * @param amount The amount of currency being transferred.
     * @param currency The identifier for the currency being transferred.
     * @param status The current status of the transaction.
     * @param timestamp The timestamp when the transaction was created.
     * @param priority The priority level of the transaction.
     */
    struct Transaction {
        bytes32 id;
        address from;
        address to;
        uint256 amount;
        bytes32 currency;
        TransactionStatus status;
        uint256 timestamp;
        uint256 priority;
    }

    /**
     * @dev Submits a new transaction to the system.
     * @param to The recipient's address.
     * @param amount The amount of currency to be transferred.
     * @param currency The currency identifier for the transaction.
     * @return The unique identifier of the submitted transaction.
     */
    function submitTransaction(address to, uint256 amount, bytes32 currency) external returns (bytes32);

    /**
     * @dev Processes the next transaction in the queue.
     */
    function processNextTransaction() external;

    /**
     * @dev Creates a batch of transactions for processing.
     * @param maxTransactions The maximum number of transactions to include in the batch.
     * @return The unique identifier of the created batch.
     */
    function createBatch(uint256 maxTransactions) external returns (bytes32);

    /**
     * @dev Settles a batch of transactions.
     * @param batchId The unique identifier of the batch to be settled.
     */
    function settleBatch(bytes32 batchId) external;

    /**
     * @dev Returns the current length of the transaction queue.
     * @return The number of transactions in the queue.
     */
    function getQueueLength() external view returns (uint256);

    /**
     * @dev Retrieves the details of a specific transaction.
     * @param transactionId The unique identifier of the transaction to retrieve.
     * @return The transaction's details as a `Transaction` struct.
     */
    function getTransaction(bytes32 transactionId) external view returns (Transaction memory);
}
