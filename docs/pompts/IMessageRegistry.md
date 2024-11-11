# Implementation Prompt: MessageRegistry Contract

## Contract Context
Generate a complete implementation of the MessageRegistry contract that implements IMessageRegistry interface in the GFS Protocol.

### Core Information
- **Contract Name**: MessageRegistry
- **Implements**: IMessageRegistry
- **Primary Responsibility**: Core message storage, tracking, and validation for the GFS Protocol
- **Dependencies**: None external (core protocol contract)
- **Related Contracts**: MessageRouter, MessageProcessor

### Key Requirements

1. **State Management**
   - Efficient message storage
   - Index tracking for sender/target messages
   - Status management
   - Message history

2. **Access Control**
   - REGISTRAR_ROLE: Allowed to register messages
   - PROCESSOR_ROLE: Allowed to update message status
   - ADMIN_ROLE: Protocol administration

3. **Storage Structures**
```solidity
// Required mappings:
mapping(bytes32 => ISO20022Message) private messages;
mapping(address => bytes32[]) private senderMessages;
mapping(address => bytes32[]) private targetMessages;
mapping(bytes32 => bool) private processedMessages;
```

4. **Core Functionality**
   - Message registration with duplicate prevention
   - Status updates with proper access control
   - Message retrieval with efficient indexing
   - Query functions for message history

5. **Security Requirements**
   - Input validation for all parameters
   - Status transition validation
   - Access control for critical functions
   - Event emissions for all state changes

6. **Gas Optimization Requirements**
   - Efficient storage patterns
   - Optimized message indexing
   - Minimal state changes
   - Batch operation support

### Implementation Requirements

1. **Message Registration**
   - Generate unique messageId
   - Validate message parameters
   - Store message data
   - Update indices
   - Emit events

2. **Status Management**
   - Status transition validation
   - Access control checks
   - State updates
   - Event emissions

3. **Query Functions**
   - Message retrieval
   - History tracking
   - Status checks
   - Index queries

4. **Administrative Functions**
   - Emergency controls
   - Access management
   - Configuration updates

### Testing Considerations
1. Message registration scenarios
2. Status update flows
3. Access control verification
4. Query function validation
5. Gas optimization checks

Please provide a complete, production-ready implementation that includes:
1. Full contract code with proper documentation
2. All required function implementations
3. Events and error definitions
4. Security measures and access control
5. Gas optimizations
6. Testing guidelines

The implementation should align with the GFS Protocol's overall architecture and support future protocol upgrades.