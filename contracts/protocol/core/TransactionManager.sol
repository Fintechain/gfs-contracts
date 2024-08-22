pragma solidity ^0.8.0;

import "../../interfaces/IAccountManager.sol";
import "../../interfaces/ITransactionManager.sol";
import "../../interfaces/IParticipantRegistry.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract TransactionManager is Initializable, ITransactionManager, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {

    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");

    IAccountManager private balanceManager;
    IParticipantRegistry private participantRegistry;

    mapping(bytes32 => Transaction) private transactions;
    mapping(bytes32 => bytes32[]) private batches;

    bytes32[] private transactionQueue;
    uint256 private transactionCounter;

    event TransactionSubmitted(bytes32 indexed transactionId, address indexed from, address indexed to, uint256 amount, bytes32 currency);
    event TransactionStatusUpdated(bytes32 indexed transactionId, TransactionStatus newStatus);
    event BatchCreated(bytes32 indexed batchId, uint256 transactionCount);
    event BatchSettled(bytes32 indexed batchId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _participantRegistry, address _balanceManager) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        participantRegistry = IParticipantRegistry(_participantRegistry);
        balanceManager = IAccountManager(_balanceManager);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROCESSOR_ROLE, msg.sender);
    }

    modifier onlyProcessor() {
        require(hasRole(PROCESSOR_ROLE, msg.sender), "Caller is not a processor");
        _;
    }

    function submitTransaction(address to, uint256 amount, bytes32 currency) 
        external 
        override 
        whenNotPaused 
        nonReentrant 
        returns (bytes32) 
    {
        require(participantRegistry.isActiveParticipant(msg.sender), "Sender is not an active participant");
        require(participantRegistry.isActiveParticipant(to), "Recipient is not an active participant");
        require(amount > 0, "Amount must be greater than zero");

        bytes32 transactionId = keccak256(abi.encodePacked(msg.sender, to, amount, currency, block.timestamp, transactionCounter));
        incrementCounter();

        Transaction memory newTransaction = Transaction({
            id: transactionId,
            from: msg.sender,
            to: to,
            amount: amount,
            currency: currency,
            status: TransactionStatus.Pending,
            timestamp: block.timestamp,
            priority: 0 // Default priority, can be updated later if needed
        });

        transactions[transactionId] = newTransaction;
        transactionQueue.push(transactionId);

        emit TransactionSubmitted(transactionId, msg.sender, to, amount, currency);

        return transactionId;
    }

    function processNextTransaction() external override onlyProcessor whenNotPaused nonReentrant {
        require(transactionQueue.length > 0, "No transactions in queue");

        bytes32 transactionId = transactionQueue[0];
        Transaction storage transaction = transactions[transactionId];

        require(transaction.status == TransactionStatus.Pending, "Transaction is not pending");

        balanceManager.reserveLiquidity(transaction.from, transaction.currency, transaction.amount);
       /*  
        bool success = balanceManager.reserveLiquidity(transaction.from, transaction.currency, transaction.amount);
        if (success) {
            transaction.status = TransactionStatus.Queued;
            emit TransactionStatusUpdated(transactionId, TransactionStatus.Queued);
        } else {
            transaction.status = TransactionStatus.Failed;
            emit TransactionStatusUpdated(transactionId, TransactionStatus.Failed);
        } */

        // Remove the processed transaction from the queue
        transactionQueue[0] = transactionQueue[transactionQueue.length - 1];
        transactionQueue.pop();
    }

    function createBatch(uint256 maxTransactions) 
        external 
        override 
        onlyProcessor 
        whenNotPaused 
        returns (bytes32) 
    {
        require(maxTransactions > 0, "Max transactions must be greater than zero");
        require(transactionQueue.length > 0, "No transactions in queue");

        bytes32 batchId = keccak256(abi.encodePacked(block.timestamp, msg.sender, maxTransactions));
        uint256 batchSize = Math.min(maxTransactions, transactionQueue.length);

        for (uint256 i = 0; i < batchSize; i++) {
            bytes32 transactionId = transactionQueue[i];
            if (transactions[transactionId].status == TransactionStatus.Queued) {
                batches[batchId].push(transactionId);
            }
        }

        require(batches[batchId].length > 0, "No eligible transactions for batch");

        emit BatchCreated(batchId, batches[batchId].length);

        return batchId;
    }

    function settleBatch(bytes32 batchId) external override onlyProcessor whenNotPaused nonReentrant {
        require(batches[batchId].length > 0, "Batch does not exist or is empty");

        for (uint256 i = 0; i < batches[batchId].length; i++) {
            bytes32 transactionId = batches[batchId][i];
            Transaction storage transaction = transactions[transactionId];

            if (transaction.status == TransactionStatus.Queued) {
                /**
                 * TODO: Make this function work with requirement for isCredit parameter 
                 */
                balanceManager.updateBalance(transaction.from, transaction.currency, transaction.amount, true);
                transaction.status = TransactionStatus.Settled;
                emit TransactionStatusUpdated(transactionId, TransactionStatus.Settled);
            }
        }

        delete batches[batchId];
        emit BatchSettled(batchId);
    }

    function getQueueLength() external view override returns (uint256) {
        return transactionQueue.length;
    }

    function getTransaction(bytes32 transactionId) external view override returns (Transaction memory) {
        require(transactions[transactionId].id == transactionId, "Transaction does not exist");
        return transactions[transactionId];
    }

    // Additional helper functions

    function getQueuedTransactions(uint256 start, uint256 end) external view returns (Transaction[] memory) {
        require(start < end && end <= transactionQueue.length, "Invalid range");
        Transaction[] memory queuedTransactions = new Transaction[](end - start);
        for (uint256 i = start; i < end; i++) {
            queuedTransactions[i - start] = transactions[transactionQueue[i]];
        }
        return queuedTransactions;
    }

    function updateTransactionPriority(bytes32 transactionId, uint256 newPriority) external onlyProcessor {
        require(transactions[transactionId].id == transactionId, "Transaction does not exist");
        transactions[transactionId].priority = newPriority;
    }

    // Admin functions

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function addProcessor(address processor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(PROCESSOR_ROLE, processor);
    }

    function removeProcessor(address processor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(PROCESSOR_ROLE, processor);
    }
    
    function getCurrentCount() public view returns (uint256) {
        return transactionCounter;
    }
    function incrementCounter() internal returns (uint256) {
        unchecked {
            return ++transactionCounter;
        }
    }
}
