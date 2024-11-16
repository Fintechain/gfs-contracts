# GFS Protocol - Message Flow Specification
Version 1.0.0

## 1. Message Flow Overview

The GFS Protocol's messaging system follows a structured flow designed to ensure secure, traceable, and standardized processing of financial messages across blockchain networks. The system processes each message through distinct phases, with each contract playing a specific role in the message's lifecycle.

## 2. Core Contracts and Their Roles

### 2.1 Message Registry (Entry Point)

The MessageRegistry serves as the primary entry point for all messages in the system. Its critical role is to maintain an immutable record of all messages and their current status throughout their lifecycle. When a financial institution submits a message:

1. The MessageRegistry first creates a unique messageId using:
   - Message type (e.g., PACS.008)
   - Source and target information
   - Timestamp
   - Unique transaction elements

2. It then stores the complete message structure:
```solidity
struct ISO20022Message {
    bytes32 messageId;        
    bytes32 messageType;      
    bytes32 messageHash;      
    address sender;          
    address target;          
    uint16 targetChain;      
    uint256 timestamp;       
    bytes payload;           
    MessageStatus status;    
}
```

After registration, the MessageRegistry becomes the source of truth for message status and history. All subsequent operations by other contracts must update the message status through the MessageRegistry.

### 2.2 Message Router (Navigation)

The MessageRouter determines and executes the appropriate path for message delivery. Its decision-making process follows:

1. **Target Analysis**:
   - Queries TargetRegistry to validate the destination
   - Determines if target is on current chain or requires cross-chain delivery
   - Verifies target can process the message type

2. **Route Selection**:
   - Local Route: Direct delivery to target on same chain
   - Cross-Chain Route: Preparation for Wormhole delivery
   - Hybrid Route: Combination for complex message types

3. **Delivery Execution**:
   ```solidity
   // For cross-chain delivery
   function _routeCrossChain(
       bytes32 messageId,
       address target,
       uint16 targetChain,
       bytes memory payload
   ) internal returns (bytes32 deliveryHash) {
       // Package message for cross-chain delivery
       bytes memory vaaPayload = abi.encode(
           messageId,
           msg.sender,
           target,
           payload
       );

       // Initiate Wormhole delivery
       return wormholeRelayer.sendMessage(
           targetChain,
           target,
           vaaPayload,
           deliveryGasLimit
       );
   }
   ```

### 2.3 Message Processor (Business Logic)

The MessageProcessor coordinates the execution of message-specific business logic through specialized handlers. Its workflow is:

1. **Handler Resolution**:
   - Identifies appropriate handler for message type
   - Verifies handler is registered and active
   - Prepares execution context

2. **Processing Execution**:
   - Invokes handler with message payload
   - Monitors execution status
   - Manages processing outcomes

3. **Settlement Coordination**:
   - Determines if settlement is required
   - Coordinates with SettlementController if needed
   - Tracks settlement status

### 2.4 Settlement Controller (Value Transfer)

The SettlementController manages the actual transfer of value when required by message processing. Its operation sequence:

1. **Settlement Initiation**:
   - Validates settlement requirements
   - Coordinates with LiquidityPool
   - Initiates cross-chain transfer if needed

2. **Settlement Execution**:
   - Locks required liquidity
   - Executes token transfer
   - Manages settlement completion

## 3. Message Flow Sequence

### 3.1 Standard Message Flow

1. **Message Submission**
   ```plaintext
   Financial Institution → MessageRegistry
   Purpose: Initial message submission and registration
   
   Actions:
   - Validate basic message structure
   - Generate unique messageId
   - Create initial message record
   - Set status to PENDING
   - Emit MessageRegistered event
   ```

2. **Route Determination**
   ```plaintext
   MessageRegistry → MessageRouter
   Purpose: Determine message delivery path
   
   Actions:
   - Validate target through TargetRegistry
   - Determine delivery method
   - Calculate delivery fees
   - Prepare delivery parameters
   ```

3. **Message Processing**
   ```plaintext
   MessageRouter → MessageProcessor
   Purpose: Execute message-specific business logic
   
   Actions:
   - Resolve appropriate handler
   - Execute business logic
   - Determine settlement needs
   - Update message status
   ```

4. **Settlement (if required)**
   ```plaintext
   MessageProcessor → SettlementController
   Purpose: Execute value transfer
   
   Actions:
   - Lock required liquidity
   - Execute token transfer
   - Monitor settlement completion
   - Update message status
   ```

### 3.2 Cross-Chain Flow Specifics

When a message requires cross-chain delivery:

1. **Source Chain Processing**
   ```plaintext
   MessageRouter:
   - Packages message for cross-chain delivery
   - Calculates required fees
   - Initiates Wormhole message
   - Updates message status to IN_TRANSIT
   ```

2. **Cross-Chain Delivery**
   ```plaintext
   Wormhole Protocol:
   - Validates message on source chain
   - Generates VAA (Verified Action Approval)
   - Delivers to target chain
   ```

3. **Target Chain Reception**
   ```plaintext
   Target Chain:
   - Validates incoming VAA
   - Reconstructs original message
   - Initiates local processing
   - Updates status to DELIVERED
   ```

## 4. Status Tracking

The MessageRegistry maintains comprehensive status tracking:

```solidity
enum MessageStatus {
    PENDING,     // Initial registration
    PROCESSING,  // Under processing
    IN_TRANSIT,  // Cross-chain delivery
    DELIVERED,   // Reached target
    COMPLETED,   // Processing complete
    FAILED       // Processing failed
}
```

Each status change must:
1. Be initiated by authorized contract
2. Follow valid status transition paths
3. Emit appropriate events
4. Update timestamp and metadata

## 5. Error Handling

The system implements multi-level error handling:

1. **Validation Errors**:
   - Input validation at MessageRegistry
   - Target validation at MessageRouter
   - Business validation at MessageProcessor

2. **Processing Errors**:
   - Handler execution failures
   - Settlement failures
   - Cross-chain delivery failures

3. **Recovery Mechanisms**:
   - Automatic retry for certain failures
   - Manual intervention capabilities
   - Status rollback procedures

You're right. Let me provide a more logical and detailed explanation of the message flow and architecture:

1. **Architectural Flow Rationale**:
```plaintext
[Financial Institution] → [MessageRegistry] → [MessageRouter] → [MessageProcessor] → [SettlementController]
         ↓                       ↑                  ↑                    ↑                    ↑
         |                [MessageProtocol]   [TargetRegistry]    [MessageHandlers]    [LiquidityPool]
```

2. **Detailed Flow With Rationale**:

A. **Entry Point - Financial Institution**:
```plaintext
Bank A wants to send a credit transfer (PACS.008) to Bank B on another chain
Needs to: 
1. Submit standardized message
2. Ensure delivery
3. Track processing
```

B. **First Stop - MessageRegistry**:
```solidity
// Bank calls
MessageRegistry.registerMessage(
    messageType: "PACS.008",
    messageHash: hash,
    target: bankBAddress,
    targetChain: targetChainId,
    payload: iso20022Message
);
```
Rationale:
- Acts as immutable record keeper
- Single entry point for all messages
- Maintains message history and status
- Enables message tracking and audit

C. **Validation - MessageProtocol**:
```solidity
// MessageRegistry calls
MessageProtocol.validateMessage(
    messageType,
    payload
);
```
Rationale:
- Ensures message compliance before processing
- Validates against ISO20022 standards
- Prevents invalid messages from entering system
- Registry must validate before accepting message

D. **Routing - MessageRouter**:
```solidity
// After message is registered and validated
MessageRouter.routeMessage(
    messageId,
    target,
    targetChain,
    payload
);
```
Rationale:
- Determines how message reaches destination
- Handles cross-chain vs local delivery
- Manages Wormhole integration
- Ensures proper message delivery path

E. **Processing - MessageProcessor**:
```solidity
// Called by MessageRouter once delivery path is determined
MessageProcessor.processMessage(
    messageId,
    messageType,
    payload
);

// Which then calls appropriate handler
IMessageHandler(handler).handleMessage(
    messageId,
    messageType,
    payload
);
```
Rationale:
- Executes business logic for each message type
- Coordinates with specific handlers
- Determines if settlement is needed
- Manages processing lifecycle

F. **Settlement - SettlementController**:
```solidity
// Called by MessageHandler if settlement required
SettlementController.initiateSettlement(
    messageId,
    sourceToken,
    targetToken,
    amount,
    targetChain,
    recipient
);
```
Rationale:
- Manages cross-chain value transfer
- Coordinates with liquidity pools
- Ensures settlement finality
- Handles token bridging

3. **Complete Example Flow With Rationale**:

```plaintext
1. Initial Submission:
   Bank A → MessageRegistry
   - Bank A submits PACS.008 credit transfer
   - Destination: Bank B on Avalanche
   - Amount: 1000 USDC
   Rationale: Single entry point ensures consistent message handling

2. Message Validation:
   MessageRegistry → MessageProtocol
   - Registry first checks with Protocol
   - Validates PACS.008 format and fields
   - Ensures compliance before acceptance
   Rationale: Front-load validation to prevent invalid processing

3. Message Registration:
   MessageRegistry
   - Generates unique messageId
   - Stores message details
   - Sets initial status as PENDING
   Rationale: Establish audit trail and tracking

4. Route Determination:
   MessageRegistry → MessageRouter
   - Registry notifies Router of new message
   - Router checks TargetRegistry for Bank B validity
   - Determines cross-chain route needed
   Rationale: Determine optimal delivery path

5. Processing Initiation:
   MessageRouter → MessageProcessor
   - Router delivers to Processor
   - Processor identifies PACS008Handler
   - Handler validates business rules
   Rationale: Separate business logic from transport

6. Settlement Trigger:
   MessageProcessor → SettlementController
   - Handler determines settlement needed
   - Initiates 1000 USDC transfer
   - Coordinates with LiquidityPool
   Rationale: Handle value transfer separately from message

7. Cross-Chain Settlement:
   SettlementController → LiquidityPool → Wormhole
   - Checks liquidity availability
   - Locks required USDC
   - Initiates cross-chain transfer
   Rationale: Manage risk and ensure funds availability

8. Status Updates:
   Each contract updates MessageRegistry
   - Components report progress
   - Registry maintains current status
   - Emits tracking events
   Rationale: Maintain complete audit trail
```

4. **Key Architectural Principles**:

1. Separation of Concerns:
   - MessageRegistry: Record keeping
   - MessageProtocol: Standards compliance
   - MessageRouter: Delivery management
   - MessageProcessor: Business logic
   - SettlementController: Value transfer

2. Modularity:
   - Each component has specific role
   - Components are independently upgradeable
   - New message types can be added via handlers

3. Security:
   - Validation before processing
   - Multiple checkpoints
   - Clear access control

4. Auditability:
   - Central registry
   - Status tracking
   - Event emissions

Would you like me to elaborate on any specific component interaction or provide more detailed examples of how certain message types flow through the system?