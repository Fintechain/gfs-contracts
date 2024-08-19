Decentralized RTGS System Formal Specification
==============================================

1. ParticipantRegistry Contract
--------------------------------

Purpose: Manages the registration and status of participants in the RTGS system.

State Variables:
- participants: mapping(address => Participant)
  - Stores participant details keyed by their Ethereum address
- participantList: address[]
  - Array of all participant addresses for enumeration

Structs:
- Participant:
  - addr: address
    - Ethereum address of the participant
  - name: string
    - Name of the participant institution
  - status: ParticipantStatus
    - Current status of the participant
  - joinDate: uint256
    - Timestamp of when the participant joined the system

Enums:
- ParticipantStatus: { Active, Suspended, Inactive }
  - Represents the possible states of a participant

Events:
- ParticipantRegistered(address indexed participantAddress, string name)
  - Emitted when a new participant is registered
- ParticipantStatusChanged(address indexed participantAddress, ParticipantStatus newStatus)
  - Emitted when a participant's status is updated

Functions:
- registerParticipant(string memory name) public
  - Registers a new participant
  - Requirements:
    - Caller is not already registered
    - Name is not empty
  - Effects:
    - Creates a new Participant struct
    - Sets status to Active
    - Sets joinDate to current timestamp
    - Adds participant to participantList
    - Emits ParticipantRegistered event

- updateParticipantStatus(address participantAddress, ParticipantStatus newStatus) public
  - Updates the status of a participant
  - Requirements:
    - Caller has appropriate permissions
    - Participant exists
    - New status is different from current status
  - Effects:
    - Updates participant's status
    - Emits ParticipantStatusChanged event

- getParticipant(address participantAddress) public view returns (Participant memory)
  - Retrieves participant details
  - Requirements:
    - Participant exists
  - Returns:
    - Participant struct for the given address

- getParticipantCount() public view returns (uint256)
  - Returns the total number of registered participants

2. TransactionManager Contract
-------------------------------

Purpose: Manages the lifecycle of transactions, including submission, queueing, and settlement.

State Variables:
- transactions: mapping(bytes32 => Transaction)
  - Stores transaction details keyed by transaction ID
- batches: mapping(bytes32 => bytes32[])
  - Stores arrays of transaction IDs for each batch
- transactionQueue: bytes32[]
  - Internal queue of transaction IDs waiting to be processed

Structs:
- Transaction:
  - id: bytes32
    - Unique identifier for the transaction
  - from: address
    - Address of the sender
  - to: address
    - Address of the recipient
  - amount: uint256
    - Amount of currency to be transferred
  - currency: bytes32
    - Currency code of the transaction
  - status: TransactionStatus
    - Current status of the transaction
  - timestamp: uint256
    - Timestamp when the transaction was submitted
  - priority: uint256
    - Priority level of the transaction for queue ordering

Enums:
- TransactionStatus: { Pending, Queued, Settled, Failed }
  - Represents the possible states of a transaction

Events:
- TransactionSubmitted(bytes32 indexed transactionId, address from, address to, uint256 amount, bytes32 currency)
  - Emitted when a new transaction is submitted
- TransactionSettled(bytes32 indexed transactionId)
  - Emitted when a transaction is settled
- BatchSettled(bytes32 indexed batchId)
  - Emitted when a batch of transactions is settled

Functions:
- submitTransaction(address to, uint256 amount, bytes32 currency) public returns (bytes32)
  - Submits a new transaction to the system
  - Requirements:
    - Sender is a registered and active participant
    - Recipient is a registered and active participant
    - Amount is greater than zero
    - Currency is valid
  - Effects:
    - Creates a new Transaction struct
    - Assigns a unique transaction ID
    - Sets initial status to Pending
    - Adds transaction to the queue or processes it immediately based on system load
    - Emits TransactionSubmitted event
  - Returns:
    - Unique transaction ID

- processNextTransaction() public
  - Processes the next transaction in the queue
  - Requirements:
    - Transaction queue is not empty
    - Caller has appropriate permissions
  - Effects:
    - Dequeues the next transaction
    - Attempts to settle the transaction
    - Updates transaction status
    - Emits TransactionSettled event if successful

- createBatch(uint256 maxTransactions) public returns (bytes32)
  - Creates a new batch of transactions for settlement
  - Requirements:
    - Caller has appropriate permissions
    - maxTransactions is greater than zero
  - Effects:
    - Selects up to maxTransactions from the queue
    - Creates a new batch with a unique ID
    - Returns the batch ID

- settleBatch(bytes32 batchId) public
  - Settles all transactions in a batch
  - Requirements:
    - Batch exists
    - Caller has appropriate permissions
  - Effects:
    - Processes each transaction in the batch
    - Updates transaction statuses
    - Emits TransactionSettled event for each settled transaction
    - Emits BatchSettled event

- getQueueLength() public view returns (uint256)
  - Returns the current length of the transaction queue

- getTransaction(bytes32 transactionId) public view returns (Transaction memory)
  - Retrieves details of a specific transaction
  - Requirements:
    - Transaction exists
  - Returns:
    - Transaction struct for the given ID

3. BalanceAndLiquidityManager Contract
---------------------------------------

Purpose: Manages account balances and liquidity reserves for participants.

State Variables:
- accounts: mapping(address => mapping(bytes32 => Account))
  - Stores account details for each participant and currency

Structs:
- Account:
  - balance: uint256
    - Current balance of the account
  - reservedLiquidity: uint256
    - Amount of liquidity reserved for pending transactions
  - active: bool
    - Whether the account is active or not

Events:
- AccountCreated(address indexed owner, bytes32 indexed currency)
  - Emitted when a new account is created
- BalanceUpdated(address indexed owner, bytes32 indexed currency, uint256 newBalance)
  - Emitted when an account balance is updated
- LiquidityReserved(address indexed owner, bytes32 indexed currency, uint256 amount)
  - Emitted when liquidity is reserved
- LiquidityReleased(address indexed owner, bytes32 indexed currency, uint256 amount)
  - Emitted when reserved liquidity is released

Functions:
- createAccount(bytes32 currency) public
  - Creates a new account for a participant in the specified currency
  - Requirements:
    - Caller is a registered and active participant
    - Account doesn't already exist for this currency
  - Effects:
    - Creates a new Account struct
    - Sets initial balance and reservedLiquidity to zero
    - Sets account as active
    - Emits AccountCreated event

- getBalance(address owner, bytes32 currency) public view returns (uint256)
  - Retrieves the current balance of an account
  - Requirements:
    - Account exists and is active
  - Returns:
    - Current balance of the account

- updateBalance(address owner, bytes32 currency, uint256 amount, bool isCredit) public
  - Updates the balance of an account
  - Requirements:
    - Caller has appropriate permissions
    - Account exists and is active
    - For debits, sufficient balance is available
  - Effects:
    - Increases or decreases the account balance
    - Emits BalanceUpdated event

- reserveLiquidity(address owner, bytes32 currency, uint256 amount) public
  - Reserves liquidity for pending transactions
  - Requirements:
    - Caller has appropriate permissions
    - Account exists and is active
    - Sufficient available balance (balance - reservedLiquidity)
  - Effects:
    - Increases reservedLiquidity
    - Emits LiquidityReserved event

- releaseLiquidity(address owner, bytes32 currency, uint256 amount) public
  - Releases previously reserved liquidity
  - Requirements:
    - Caller has appropriate permissions
    - Account exists and is active
    - Amount doesn't exceed reservedLiquidity
  - Effects:
    - Decreases reservedLiquidity
    - Emits LiquidityReleased event

- getAvailableLiquidity(address owner, bytes32 currency) public view returns (uint256)
  - Calculates available liquidity for an account
  - Requirements:
    - Account exists and is active
  - Returns:
    - Available liquidity (balance - reservedLiquidity)

4. CurrencyRegistry Contract
-----------------------------

Purpose: Manages the list of supported currencies in the system.

State Variables:
- currencies: mapping(bytes32 => Currency)
  - Stores currency details keyed by currency code
- currencyList: bytes32[]
  - Array of all currency codes for enumeration

Structs:
- Currency:
  - name: string
    - Full name of the currency
  - decimals: uint8
    - Number of decimal places for the currency
  - active: bool
    - Whether the currency is currently active in the system

Events:
- CurrencyAdded(bytes32 indexed currencyCode, string name)
  - Emitted when a new currency is added
- CurrencyStatusChanged(bytes32 indexed currencyCode, bool active)
  - Emitted when a currency's active status is changed

Functions:
- addCurrency(bytes32 currencyCode, string memory name, uint8 decimals) public
  - Adds a new currency to the system
  - Requirements:
    - Caller has appropriate permissions
    - Currency code doesn't already exist
    - Name is not empty
    - Decimals is within a valid range
  - Effects:
    - Creates a new Currency struct
    - Adds currency to currencyList
    - Sets currency as active
    - Emits CurrencyAdded event

- updateCurrencyStatus(bytes32 currencyCode, bool active) public
  - Updates the active status of a currency
  - Requirements:
    - Caller has appropriate permissions
    - Currency exists
    - New status is different from current status
  - Effects:
    - Updates currency's active status
    - Emits CurrencyStatusChanged event

- getCurrency(bytes32 currencyCode) public view returns (Currency memory)
  - Retrieves details of a specific currency
  - Requirements:
    - Currency exists
  - Returns:
    - Currency struct for the given code

- getCurrencyCount() public view returns (uint256)
  - Returns the total number of registered currencies

5. CollateralManager Contract
------------------------------

Purpose: Manages collateral deposits and valuations for participants.

State Variables:
- collaterals: mapping(address => mapping(bytes32 => Collateral))
  - Stores collateral details for each participant and asset type

Structs:
- Collateral:
  - assetType: bytes32
    - Type of collateral asset
  - amount: uint256
    - Amount of collateral deposited
  - valueInBaseCurrency: uint256
    - Current value of collateral in the system's base currency

Events:
- CollateralDeposited(address indexed owner, bytes32 indexed assetType, uint256 amount)
  - Emitted when collateral is deposited
- CollateralWithdrawn(address indexed owner, bytes32 indexed assetType, uint256 amount)
  - Emitted when collateral is withdrawn
- CollateralValueUpdated(address indexed owner, bytes32 indexed assetType, uint256 newValue)
  - Emitted when collateral value is updated

Functions:
- depositCollateral(bytes32 assetType, uint256 amount) public
  - Deposits collateral for a participant
  - Requirements:
    - Caller is a registered and active participant
    - Asset type is supported
    - Amount is greater than zero
  - Effects:
    - Increases collateral amount for the participant
    - Emits CollateralDeposited event

- withdrawCollateral(bytes32 assetType, uint256 amount) public
  - Withdraws collateral for a participant
  - Requirements:
    - Caller is a registered and active participant
    - Sufficient collateral is available
    - Withdrawal doesn't violate any system constraints
  - Effects:
    - Decreases collateral amount for the participant
    - Emits CollateralWithdrawn event

- updateCollateralValue(address owner, bytes32 assetType, uint256 newValue) public
  - Updates the value of collateral in the base currency
  - Requirements:
    - Caller has appropriate permissions
    - Collateral exists for the participant and asset type
  - Effects:
    - Updates valueInBaseCurrency for the collateral
    - Emits CollateralValueUpdated event

- getCollateralValue(address owner, bytes32 assetType) public view returns (uint256)
  - Retrieves the current value of collateral for a participant
  - Requirements:
    - Collateral exists for the participant and asset type
  - Returns:
    - Current value of collateral in the base currency

6. FeeCalculator Contract
--------------------------

Purpose: Calculates transaction fees based on defined fee structures.

State Variables:
- feeStructures: mapping(bytes32 => FeeStructure)
  - Stores fee structures for different transaction types

Structs:
- FeeStructure:
  - baseFee: uint256
    - Fixed base fee for the transaction type
  - percentageFee: uint256
    - Variable fee as a percentage of transaction amount (in basis points)

Events:
- FeeStructureUpdated(bytes32 indexed transactionType, uint256 baseFee, uint256 percentageFee)
  - Emitted when a fee structure is updated

Functions:
- setFeeStructure(bytes32 transactionType, uint256 baseFee, uint256 percentageFee) public
  - Sets or updates the fee structure for a transaction type
  - Requirements:
    - Caller has appropriate permissions
    - Percentage fee is within a valid range (e.g., 0-10000 basis points)
  - Effects:
    - Creates or updates FeeStructure for the transaction type
    - Emits FeeStructureUpdated event

- calculateFee(bytes32 transactionType, uint256 transactionAmount) public view returns (uint256)
  - Calculates the fee for a given transaction
  - Requirements:
    - Fee structure exists for the transaction type
  - Returns:
    - Calculated fee (baseFee + (transactionAmount * percentageFee / 10000))

7. AuditLog Contract
---------------------

Purpose: Maintains a tamper-resistant log of important system events.

State Variables:
- logs: LogEntry[]
  - Array of all log entries

Structs:
- LogEntry:
  - eventType: bytes32
    - Type of event being logged
  - initiator: address
    - Address that initiated the event
  - data: bytes
    - Additional data related to the event
  - timestamp: uint256
    - Timestamp when the event was logged

Events:
- LogEntryAdded(uint256 indexed logIndex, bytes32 indexed eventType)
  - Emitted when a new log entry is added

Functions:
- addLogEntry(bytes32 eventType, bytes memory data) public
  - Adds a new entry to the audit log
  - Requirements:
    - Caller has appropriate permissions
  - Effects:
    - Creates a new LogEntry struct
    - Adds entry to the logs array
    - Emits LogEntryAdded event

- getLogEntry(uint256 index) public view returns (LogEntry memory)
  - Retrieves a specific log entry
  - Requirements:
    - Index is within the valid range
  - Returns:
    - LogEntry struct for the given index

- getLogCount() public view returns (uint256)
  - Returns the total number of log entries

8. GovernanceContract (continued)
----------------------------------

Structs:
- Proposal:
  - proposer: address
    - Address that created the proposal
  - proposalType: bytes32
    - Type of proposal (e.g., "UpdateFeeStructure", "AddCurrency")
  - data: bytes
    - Encoded data specific to the proposal type
  - votesFor: uint256
    - Number of votes in favor of the proposal
  - votesAgainst: uint256
    - Number of votes against the proposal
  - status: ProposalStatus
    - Current status of the proposal

Enums:
- ProposalStatus: { Active, Passed, Rejected, Executed }
  - Represents the possible states of a proposal

Events:
- ProposalCreated(uint256 indexed proposalId, address proposer)
  - Emitted when a new proposal is created
- VoteCast(uint256 indexed proposalId, address voter, bool inFavor)
  - Emitted when a vote is cast on a proposal
- ProposalExecuted(uint256 indexed proposalId)
  - Emitted when a proposal is executed

Functions:
- createProposal(bytes32 proposalType, bytes memory data) public
  - Creates a new governance proposal
  - Requirements:
    - Caller is a registered governor
    - Proposal type is valid
  - Effects:
    - Creates a new Proposal struct
    - Assigns a unique proposal ID
    - Sets initial status to Active
    - Increments proposalCount
    - Emits ProposalCreated event

- vote(uint256 proposalId, bool inFavor) public
  - Casts a vote on an active proposal
  - Requirements:
    - Caller is a registered governor
    - Proposal exists and is Active
    - Governor hasn't already voted on this proposal
  - Effects:
    - Increments votesFor or votesAgainst
    - Records that the governor has voted
    - Checks if the proposal has passed or been rejected based on voting thresholds
    - Updates proposal status if necessary
    - Emits VoteCast event

- executeProposal(uint256 proposalId) public
  - Executes a passed proposal
  - Requirements:
    - Caller has appropriate permissions
    - Proposal exists and has Passed status
  - Effects:
    - Executes the proposal based on its type and data
    - Sets proposal status to Executed
    - Emits ProposalExecuted event

- addGovernor(address newGovernor) public
  - Adds a new address to the list of governors
  - Requirements:
    - Caller has appropriate permissions
    - Address is not already a governor
  - Effects:
    - Sets the address as a governor in the governors mapping

- removeGovernor(address governor) public
  - Removes an address from the list of governors
  - Requirements:
    - Caller has appropriate permissions
    - Address is currently a governor
  - Effects:
    - Removes the address from the governors mapping

- isGovernor(address account) public view returns (bool)
  - Checks if an address has governance rights
  - Returns:
    - Boolean indicating whether the address is a governor

- getProposal(uint256 proposalId) public view returns (Proposal memory)
  - Retrieves details of a specific proposal
  - Requirements:
    - Proposal exists
  - Returns:
    - Proposal struct for the given ID

- getProposalCount() public view returns (uint256)
  - Returns the total number of proposals created

System-wide Considerations
---------------------------

1. Access Control:
   - Implement a robust access control system to manage permissions for different functions across all contracts.
   - Consider using a role-based access control (RBAC) system for fine-grained permission management.

2. Upgradability:
   - Design contracts with upgradability in mind, possibly using proxy patterns to allow for future improvements without losing state.

3. Intercontract Communication:
   - Define clear interfaces for communication between contracts to ensure proper encapsulation and modularity.

4. Error Handling:
   - Implement comprehensive error handling and revert messages to provide clear feedback on failed operations.

5. Gas Optimization:
   - Consider gas costs in function designs, especially for frequently called functions.
   - Use appropriate data structures and storage patterns to minimize gas consumption.

6. Event Emission:
   - Emit events for all significant state changes to facilitate off-chain monitoring and indexing.

7. Security Considerations:
   - Implement reentrancy guards where necessary.
   - Use SafeMath or Solidity 0.8.x built-in overflow checks for arithmetic operations.
   - Carefully manage access to state-changing functions.

8. Compliance and Regulatory Considerations:
   - Design the system with hooks or modules to accommodate KYC/AML requirements.
   - Implement features to support regulatory reporting and auditing.

9. Scalability:
   - Consider mechanisms to handle high transaction volumes, such as batching or off-chain computation with on-chain settlement.

10. Interoperability:
    - Design the system with potential future interoperability with other blockchain networks or traditional financial systems in mind.

This specification provides a comprehensive overview of the decentralized RTGS system's structure and functionality. It serves as a foundation for implementation and can be used as a reference for future discussions and development. The actual implementation may require additional helper functions, more detailed access controls, and optimizations based on specific requirements and constraints of the target blockchain platform.