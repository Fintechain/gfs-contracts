# Implementation Prompt: MessageRouter Contract

## Contract Context
Generate a complete implementation of the MessageRouter contract that implements IMessageRouter interface in the GFS Protocol.

### Core Information
- **Contract Name**: MessageRouter
- **Implements**: IMessageRouter
- **Primary Responsibility**: Route messages between chains and targets using Wormhole
- **Dependencies**: 
  - Wormhole Core Contract
  - Wormhole Relayer
- **Related Contracts**: MessageRegistry, TargetRegistry, MessageProcessor

### Key Requirements

1. **Wormhole Integration**
   - Message delivery
   - VAA handling
   - Cross-chain routing
   - Fee management

2. **Access Control**
   - ROUTER_ROLE: Can route messages
   - RELAYER_ROLE: Can relay messages
   - ADMIN_ROLE: Protocol administration

3. **Storage Structures**
```solidity
mapping(bytes32 => bytes32) private deliveryHashes;
mapping(bytes32 => RoutingStatus) private routingStatus;
mapping(uint16 => uint256) private chainGasLimits;
```

4. **Core Functionality**
   - Message routing
   - Cross-chain delivery
   - Fee calculation
   - Status tracking

5. **Security Requirements**
   - Source validation
   - Destination verification
   - Fee validation
   - Message verification

6. **Gas Optimization Requirements**
   - Efficient routing
   - Optimized cross-chain calls
   - Batch processing

### Implementation Requirements

1. **Message Routing**
   - Route calculation
   - Fee calculation
   - Cross-chain delivery
   - Status tracking

2. **Wormhole Integration**
   - VAA creation
   - Message packaging
   - Delivery verification
   - Fee management

3. **Status Management**
   - Routing status
   - Delivery confirmation
   - Error handling

4. **Administrative Functions**
   - Chain management
   - Fee configuration
   - Emergency controls

### Testing Considerations
1. Cross-chain routing
2. Fee calculations
3. Message delivery
4. Error handling
5. Gas optimization