# GFS Protocol: Comprehensive Data Flow and Processing Specification
Version 1.0.0

## 1. Overview
The GFS Protocol is a comprehensive system designed to process ISO20022 financial messages across blockchain networks. The protocol is composed of several interconnected components, each responsible for specific functionalities within the message processing lifecycle.

## 2. System Architecture
The GFS Protocol follows a layered architecture, with each layer handling distinct responsibilities while maintaining strict boundaries of concern. The primary layers are:

### 2.1 Registry Layer
The registry layer serves as the protocol's system of record, maintaining authoritative data about messages, targets, and processing status. This layer consists of:
- **MessageRegistry**: The central source of truth for all messages in the system. It generates unique message IDs, creates and stores message records, and manages the transitions of message status.
- **TargetRegistry**: Maintains the directory of valid message destinations, including their addresses, chain IDs, and target types. It verifies the existence and status of targets during message routing.

### 2.2 Protocol Layer
This layer enforces protocol standards and manages system governance:
- **MessageProtocol**: Enforces ISO20022 message standards, managing message format versions, validating message structure, and maintaining a schema registry.
- **ProtocolGovernance**: Handles system upgrades, parameter management, voting processes, and emergency actions.

### 2.3 Processing Layer
The processing layer executes the core message handling logic:
- **MessageRouter**: Manages message delivery paths, handles cross-chain communication via the Wormhole protocol, tracks delivery status, calculates routing fees, and manages gas limits per chain.
- **MessageProcessor**: Coordinates business logic execution, manages the handler registry, routes messages to appropriate handlers, tracks processing results, and maintains handler permissions.
- **MessageHandler**: Implements the business logic for specific message types, determines settlement requirements, and returns processing results.

### 2.4 Settlement Layer
Handles the financial settlement aspects:
- **SettlementController**: Receives settlement instructions from message handlers and the Wormhole protocol, processes settlement requests, interacts with liquidity pools, tracks settlement status, and manages trusted chain relationships.
- **LiquidityPool**: Provides the necessary liquidity for settlements, executes token transfers, manages token balances, and handles settlement execution.

## 3. Message Processing Flow
The GFS Protocol follows a structured flow for processing ISO20022 messages, which can be broken down into the following phases:

### 3.1 Message Entry and Validation
1. **Initial Contact (ProtocolCoordinator)**: The ProtocolCoordinator receives the message submission, validates the submission parameters, calculates the required fees, and checks the message size limits.
2. **Message Registration (MessageRegistry)**: The ProtocolCoordinator generates a unique message ID and registers the message in the MessageRegistry, creating the initial record and setting the status to "PENDING".
3. **Format Validation (MessageProtocol)**: The MessageRegistry forwards the message to the MessageProtocol, which validates the message format against the registered ISO20022 schemas, checks for required fields, and verifies the message type support and format version.

### 3.2 Routing and Delivery
1. **Route Analysis (MessageRouter)**: The ProtocolCoordinator delegates the routing and delivery decision to the MessageRouter, which determines the target chain location, calculates the delivery fees, selects the optimal delivery path (local or cross-chain), and prepares the routing packet.
2. **Processing Paths**:
   - **Local Processing**: The MessageRouter interacts with the MessageProcessor to resolve the appropriate message handler, execute the handler logic, and process the handler result.
   - **Cross-Chain Processing**: The MessageRouter prepares the VAA (Verified Action Approval) and transmits the message via the Wormhole protocol, tracking the delivery status and updating the MessageRegistry accordingly.

### 3.3 Handler Processing
1. **Local Handler Execution (MessageProcessor)**: The MessageProcessor invokes the appropriate message handler, which executes the business logic and determines if settlement is required.
2. **Settlement Initiation (if required)**: If the message handling requires settlement, the handler directly engages the SettlementController to initiate the settlement process.

### 3.4 Settlement Processing
1. **Settlement Sources**:
   - **Local Handler Settlement**: The handler sends the settlement parameters to the SettlementController, which processes the settlement request, executes the transaction via the LiquidityPool, and updates the settlement status.
   - **Cross-Chain Settlement**: The Wormhole protocol forwards the settlement instruction to the SettlementController, which verifies the source chain, processes the settlement, and executes the transaction through the LiquidityPool.
2. **Settlement Execution (SettlementController → LiquidityPool)**: The SettlementController verifies the available liquidity, executes the token transfer, updates the balances, and returns the settlement result.

## 4. Component Roles and Functionalities
### 4.1 ProtocolCoordinator
The ProtocolCoordinator is responsible for managing the overall message submission and processing flow. It acts as the main entry point for users, but it does not directly interact with the SettlementController. Its key responsibilities include:
1. **Message Submission and Validation**:
   - Receives the message submission from the user
   - Validates the submission parameters, such as payload size and target address
   - Calculates the required fees for message delivery and settlement
   - Generates a unique message ID and registers the message in the MessageRegistry
2. **Routing and Delivery**:
   - Delegates the routing and delivery decision to the MessageRouter
   - Handles the transfer of delivery fees to the MessageRouter
   - Tracks the progress of message delivery and updates the MessageRegistry accordingly
3. **Message Retrieval and Status Monitoring**:
   - Provides methods for retrieving message status and processing results
   - Allows users to monitor the progress of their submitted messages
4. **Protocol Configuration Management**:
   - Manages the addresses of the other protocol components
   - Allows for updating the base protocol fee
5. **Error Handling and Recovery**:
   - Implements mechanisms for retrying failed message deliveries
   - Provides an emergency cancellation function for messages

### 4.2 MessageRegistry
The MessageRegistry serves as the central repository for all message-related data within the GFS Protocol. Its key responsibilities include:
1. **Message Registration and Tracking**:
   - Generates a unique identifier (messageId) for each incoming message
   - Creates and stores the authoritative message records
   - Maintains the message status and updates it through the life cycle
2. **Message Lookup and Retrieval**:
   - Provides methods for retrieving message details by messageId
   - Allows querying messages by sender and target addresses
3. **Message Status Management**:
   - Enforces the valid message status transitions
   - Ensures atomic updates to message status
   - Logs all status changes with timestamps
4. **Integration with Other Components**:
   - Interacts with the MessageProtocol for format validation
   - Shares message data with the MessageRouter and MessageProcessor

### 4.3 TargetRegistry
The TargetRegistry is responsible for managing the directory of valid message destinations, including their addresses, chain IDs, and target types. Its key functions include:
1. **Target Registration and Updates**:
   - Allows authorized entities to register new targets
   - Provides methods for updating target status (active/inactive)
   - Maintains the metadata associated with each target
2. **Target Validation**:
   - Verifies the existence and active status of a given target address and chain ID
   - Ensures that the target supports the message type being processed
3. **Chain-Specific Target Management**:
   - Maintains separate indices for targets by chain ID
   - Allows querying targets by chain or target type
4. **Cross-Chain Emitter Management**:
   - Registers and deregisters trusted cross-chain emitters
   - Validates the authenticity of emitters during cross-chain message delivery

### 4.4 MessageRouter
The MessageRouter is responsible for determining the optimal delivery path for messages, whether local or cross-chain, and managing the associated routing fees. Its key functionalities include:
1. **Routing Decision and Execution**:
   - Analyzes the target chain ID and selects the appropriate delivery method
   - Prepares the message for local delivery or cross-chain transmission via Wormhole
   - Tracks the delivery status and updates the MessageRegistry accordingly
2. **Fee Calculation and Collection**:
   - Determines the required fees for local and cross-chain message delivery
   - Collects the delivery fees from the ProtocolCoordinator before routing the message
   - Manages the gas limits and fee parameters for each supported chain
3. **Delivery Status Monitoring**:
   - Provides methods for checking the delivery status of a routed message
   - Allows authorized entities to mark a delivery as completed
4. **Chain-Specific Considerations**:
   - Handles the specifics of local and cross-chain message delivery
   - Interfaces with the Wormhole protocol for cross-chain communication

### 4.5 MessageProcessor
The MessageProcessor is responsible for coordinating the execution of business logic for incoming messages. Its key functions include:
1. **Handler Resolution and Invocation**:
   - Identifies the appropriate message handler for a given message type
   - Validates the handler's permissions and status
   - Calls the handler's message processing logic
2. **Settlement Coordination**:
   - Determines if the message processing requires settlement
   - Engages the SettlementController to initiate the settlement process
   - Tracks the settlement status and updates the MessageRegistry accordingly
3. **Processing Result Tracking**:
   - Stores the processing results, including success/failure status and any returned data
   - Provides methods for retrieving the processing status of a message
4. **Handler Management**:
   - Allows authorized entities to register new message handlers
   - Defines the required processing actions for each message type

### 4.6 MessageHandler
The MessageHandler is responsible for executing the business logic for specific message types. It determines whether the message processing requires settlement and initiates the settlement process if needed. Its key functions include:

1. **Message Processing**:
   - Implements the business logic for handling the incoming message
   - Executes type-specific processing logic based on the message payload
   - Returns the processing result, which can include settlement parameters if required

2. **Settlement Determination**:
   - Analyzes the message type and payload to determine if settlement is necessary
   - Prepares the settlement parameters, such as source/target tokens, amount, and recipient
   - Engages the SettlementController to initiate the settlement process if required

3. **Supported Message Types**:
   - Maintains a registry of the message types it can handle
   - Provides a method to retrieve the list of supported message types


### 4.7 SettlementController
The SettlementController is responsible for managing the settlement of financial transactions, including both local and cross-chain value transfers. Its key functionalities include:
1. **Settlement Initiation and Processing**:
   - Receives settlement instructions from local message handlers and the Wormhole protocol
   - Validates the settlement parameters and generates a unique settlement ID
   - Interacts with the LiquidityPool to execute the token transfers
2. **Settlement Status Tracking**:
   - Maintains the authoritative records of all settlement transactions
   - Provides methods for retrieving settlement details by ID or associated message ID
   - Updates the settlement status through the life cycle
3. **Token Support Management**:
   - Manages the list of supported tokens and their associated chain IDs
   - Allows authorized entities to update the token support configuration
4. **Chain Trust Management**:
   - Maintains a list of trusted chains for cross-chain settlement processing
   - Enforces the trust relationships during settlement validation

### 4.8 LiquidityPool
The LiquidityPool is responsible for providing the necessary liquidity for settlements and executing the token transfers. Its key functions include:
1. **Liquidity Management**:
   - Allows liquidity providers to deposit and withdraw tokens
   - Tracks the total liquidity, available liquidity, and locked liquidity
   - Manages the minimum and maximum liquidity thresholds per token
2. **Settlement Execution**:
   - Receives settlement instructions from the SettlementController
   - Verifies the availability of required liquidity
   - Executes the token transfers to the specified recipients
3. **Liquidity Locking and Unlocking**:
   - Locks the necessary liquidity when a settlement is initiated
   - Unlocks the liquidity when the settlement is completed or cancelled
4. **Liquidity Pool Configuration**:
   - Allows authorized entities to create new liquidity pools for tokens
   - Provides methods for adding and removing supported token pairs

### 4.9 MessageProtocol
The MessageProtocol is responsible for enforcing the ISO20022 message standards and managing the protocol's versioning. Its key functionalities include:
1. **Message Format Validation**:
   - Receives messages from the MessageRegistry for format validation
   - Checks the message structure against the registered schemas
   - Verifies the presence of required fields
2. **Message Type Management**:
   - Maintains the registry of supported message types
   - Allows authorized entities to activate, deactivate, and update message formats
3. **Protocol Versioning**:
   - Manages the current protocol version and its associated schema definitions
   - Provides methods for updating the protocol version
4. **Schema and Format Governance**:
   - Ensures the consistency and compliance of the message formats
   - Enables authorized entities to register new message schemas and formats

### 4.10 ProtocolGovernance
The ProtocolGovernance contract is responsible for managing the system's administrative and governance-related functionalities. Its key responsibilities include:
1. **Proposal Management**:
   - Allows authorized entities to create new governance proposals
   - Manages the voting process for proposals, including voting periods and quorum requirements
   - Executes approved proposals
2. **Voting Power Management**:
   - Tracks the voting power of each participant
   - Provides methods for updating the voting power of individual accounts
3. **Emergency Actions**:
   - Enables authorized entities to execute emergency actions outside the regular governance process
   - Ensures that emergency actions are logged and cannot be duplicated
4. **Pausing and Unpausing**:
   - Provides the ability to pause and unpause the entire protocol's operations
   - Restricts certain actions to authorized entities during the paused state

## 5. Conclusion
This comprehensive specification outlines the detailed interactions and functionalities of the GFS Protocol's core components. By clearly defining the roles and responsibilities of each contract, the protocol ensures a modular and scalable architecture that can efficiently process ISO20022 messages and manage cross-chain financial settlements. The strict separation of concerns and the well-defined data flows between the components enable the protocol to maintain data consistency, implement robust error handling, and provide a secure and reliable platform for financial institutions.