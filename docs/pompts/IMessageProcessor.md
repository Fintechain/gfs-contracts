# Implementation Prompt: MessageProcessor Contract

## Contract Context
Generate a complete implementation of the MessageProcessor contract that implements IMessageProcessor interface in the GFS Protocol.

### Core Information
- **Contract Name**: MessageProcessor
- **Implements**: IMessageProcessor
- **Primary Responsibility**: Process different types of ISO20022 messages and execute corresponding actions
- **Dependencies**: None external
- **Related Contracts**: MessageRouter, SettlementController

### Key Requirements

1. **Message Processing**
   - Message type handling
   - Processing actions
   - Handler management
   - Status tracking

2. **Access Control**
   - PROCESSOR_ROLE: Can process messages
   - HANDLER_ADMIN_ROLE: Can manage handlers
   - ADMIN_ROLE: Protocol administration

3. **Storage Structures**
```solidity
mapping(bytes32 => address) private messageHandlers;
mapping(bytes32 => ProcessingStatus) private processingStatus;
mapping(bytes32 => ProcessingAction) private requiredActions;
```

4. **Core Functionality**
   - Message processing
   - Handler management
   - Status tracking
   - Action execution

5. **Security Requirements**
   - Handler validation
   - Message validation
   - Action verification
   - Status management

6. **Gas Optimization Requirements**
   - Efficient processing
   - Optimized handler calls
   - Status management

### Implementation Requirements

1. **Message Processing**
   - Message validation
   - Handler execution
   - Status updates
   - Event emissions

2. **Handler Management**
   - Registration
   - Verification
   - Execution
   - Status tracking

3. **Status Management**
   - Processing status
   - Action tracking
   - Error handling

4. **Administrative Functions**
   - Handler management
   - Action configuration
   - Emergency controls

### Testing Considerations
1. Message processing flows
2. Handler management
3. Action execution
4. Error handling
5. Gas optimization