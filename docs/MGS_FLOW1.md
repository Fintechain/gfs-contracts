# GFS Protocol: Contract Interactions and Data Flow Specification
Version 1.0.0

## 1. Overview of System Architecture

The GFS Protocol implements a layered architecture for processing ISO20022 financial messages across blockchain networks. The system is designed around four primary processing layers, each handling distinct responsibilities while maintaining strict boundaries of concern:

### Registry Layer (Data Persistence)
The registry layer serves as the protocol's system of record, maintaining authoritative data about messages, targets, and processing status. This layer consists of:

- MessageRegistry: The central source of truth for all messages in the system
- TargetRegistry: Maintains the directory of valid message destinations 

### Protocol Layer (Standards & Governance)
This layer enforces protocol standards and manages system governance:

- MessageProtocol: Enforces ISO20022 message standards and validation
- ProtocolGovernance: Handles system upgrades and parameter management

### Processing Layer (Business Logic)
The processing layer executes the core message handling logic:

- MessageRouter: Manages message delivery paths and cross-chain communication
- MessageProcessor: Coordinates business logic execution through handlers

### Settlement Layer (Value Transfer)
Handles the financial settlement aspects:

- SettlementController: Manages cross-chain value transfers
- LiquidityPool: Provides settlement liquidity across chains

## 2. Primary Message Processing Flow

The processing of an ISO20022 message follows a carefully orchestrated sequence of interactions between contracts. Let's examine each major phase:

### 2.1 Message Entry and Validation

When a financial institution submits a message, it triggers the following sequence:

1. Initial Contact: MessageRegistry
   - Receives the raw message submission
   - Generates a unique messageId
   - Creates preliminary message record
   
2. Format Validation: MessageProtocol
   - Receives message from Registry
   - Validates against ISO20022 schemas
   - Checks required field presence
   - Verifies format compliance
   
3. Target Validation: TargetRegistry
   - Validates target existence
   - Confirms target can process message type
   - Verifies chain ID validity

4. Status Recording: MessageRegistry
   - Creates permanent message record
   - Sets initial PENDING status
   - Indexes message for sender and target

The data flow at this stage is strictly controlled:
```
Financial Institution → MessageRegistry
                          ↓
                    MessageProtocol
                          ↓
                    TargetRegistry
                          ↓
                    MessageRegistry (final recording)
```

### 2.2 Routing Determination and Execution

Once validated, the message enters the routing phase:

1. Route Analysis: MessageRouter
   - Retrieves message from Registry
   - Determines target chain location
   - Calculates optimal delivery path
   - Estimates required gas fees

2. Delivery Path Selection:
   a) Local Delivery (same chain):
      - Direct contract call to target
      - Synchronous processing
      - Immediate status updates
   
   b) Cross-Chain Delivery:
      - Wormhole message preparation
      - VAA (Verified Action Approval) generation
      - Cross-chain message submission
      
3. Status Tracking:
   - Updates message status to IN_TRANSIT or PROCESSING
   - Records delivery hash for tracking
   - Emits routing events

The routing interaction flow:
```
MessageRegistry → MessageRouter
                     ↓
         [Determine Target Location]
                     ↓
     Local Path   or   Cross-Chain Path
        ↓                    ↓
Target Contract        Wormhole Protocol
        ↓                    ↓
Status Update     Target Chain Reception
```

### 2.3 Message Processing and Execution

The processing phase handles business logic execution:

1. Handler Resolution: MessageProcessor
   - Identifies message type
   - Locates registered handler
   - Validates handler status
   - Prepares execution context

2. Business Logic Execution:
   - Handler receives message payload
   - Executes type-specific logic
   - Determines settlement requirements
   - Returns processing result

3. Settlement Coordination (if required):
   - SettlementController engagement
   - Liquidity verification
   - Token transfer initiation
   - Settlement status tracking

The processing interaction sequence:
```
MessageProcessor → Message Handler
                      ↓
              Processing Result
                      ↓
        Settlement Required?
        Yes ↓           ↓ No
SettlementController  Status Update
        ↓
  LiquidityPool
        ↓
  Token Transfer
```

### 2.4 Settlement Processing

When settlement is required, the following interactions occur:

1. Settlement Initiation:
   - SettlementController receives request
   - Validates settlement parameters
   - Generates settlement ID
   - Creates settlement record

2. Liquidity Management:
   - LiquidityPool verification
   - Token balance checks
   - Liquidity locking
   - Fee calculation

3. Cross-Chain Settlement:
   - Token bridge engagement
   - Cross-chain transfer initiation
   - Settlement status tracking
   - Final confirmation

Settlement interaction flow:
```
SettlementController → LiquidityPool
                          ↓
                    Token Bridge
                          ↓
                Target Chain Bridge
                          ↓
                Settlement Completion
```

## 3. Cross-Chain Communication Patterns

The protocol implements several critical patterns for cross-chain operations:

### 3.1 Message Delivery Pattern

Cross-chain message delivery follows this sequence:

1. Source Chain:
   - Message packaging with metadata
   - VAA generation through Wormhole
   - Delivery tracking initialization
   - Status updates to IN_TRANSIT

2. Guardian Network:
   - VAA validation by guardians
   - Cross-chain message propagation
   - Delivery verification

3. Target Chain:
   - VAA receipt and validation
   - Message reconstruction
   - Local processing initiation
   - Status update to DELIVERED

### 3.2 Settlement Pattern

Cross-chain settlements implement:

1. Source Chain Operations:
   - Liquidity verification
   - Token locking
   - Bridge instruction creation
   - Settlement tracking initiation

2. Bridge Operations:
   - Token attestation verification
   - Cross-chain transfer execution
   - Settlement VAA generation

3. Target Chain Operations:
   - Settlement VAA verification
   - Token minting/release
   - Recipient credit
   - Settlement completion confirmation

## 4. State Management and Consistency

The protocol maintains system consistency through:

### 4.1 Status Tracking

Message status transitions are strictly controlled:

1. Valid Status Sequence:
   ```
   PENDING → PROCESSING → IN_TRANSIT → DELIVERED → COMPLETED
                                                → FAILED
   ```

2. Status Update Rules:
   - Only authorized contracts can update
   - Must follow valid transition paths
   - Updates are atomic operations
   - All updates logged with timestamps

### 4.2 Data Consistency

The system maintains consistency through:

1. Single Source of Truth:
   - MessageRegistry for message data
   - TargetRegistry for routing data
   - SettlementController for settlement data

2. Update Patterns:
   - Atomic operations for critical updates
   - Transaction rollback on failures
   - Event emissions for tracking
   - Strict access controls

## 5. Error Handling and Recovery

The protocol implements comprehensive error handling:

### 5.1 Error Categories

1. Validation Errors:
   - Message format errors
   - Target validation failures
   - Permission errors
   
2. Processing Errors:
   - Handler execution failures
   - Settlement failures
   - Cross-chain delivery failures

3. System Errors:
   - Contract interaction failures
   - Bridge operation failures
   - Network issues

### 5.2 Recovery Procedures

Each error type has specific recovery procedures:

1. Message Recovery:
   - Status rollback capabilities
   - Retry mechanisms
   - Manual intervention options

2. Settlement Recovery:
   - Liquidity unlocking
   - Token return
   - Settlement cancellation

3. System Recovery:
   - Emergency pause functionality
   - Governance intervention
   - State reconstruction capabilities

## 6. Security Considerations

The protocol implements multiple security layers:

### 6.1 Access Control

Strictly enforced role-based access:

1. Core Roles:
   - REGISTRAR_ROLE: Message registration
   - ROUTER_ROLE: Message routing
   - PROCESSOR_ROLE: Message processing
   - SETTLEMENT_ROLE: Settlement operations

2. Administrative Roles:
   - ADMIN_ROLE: System administration
   - GOVERNANCE_ROLE: Protocol governance
   - EMERGENCY_ROLE: Emergency operations

### 6.2 Validation Security

Multiple validation layers:

1. Message Validation:
   - Format compliance
   - Field validation
   - Signature verification

2. Target Validation:
   - Address verification
   - Chain ID validation
   - Permission checking

3. Operation Validation:
   - Status transition validation
   - Settlement validation
   - Cross-chain operation validation

This comprehensive interaction and data flow specification details how the GFS Protocol's contracts work together to process ISO20022 messages securely and efficiently across blockchain networks. Each component plays a specific role while maintaining clear boundaries and following established patterns for consistency and security.