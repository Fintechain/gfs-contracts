# Implementation Prompt: TargetRegistry Contract

## Contract Context
Generate a complete implementation of the TargetRegistry contract that implements ITargetRegistry interface in the GFS Protocol.

### Core Information
- **Contract Name**: TargetRegistry
- **Implements**: ITargetRegistry
- **Primary Responsibility**: Manage registration and validation of protocol participants (institutions and contracts)
- **Dependencies**: None external (core protocol contract)
- **Related Contracts**: MessageRegistry, MessageRouter

### Key Requirements

1. **State Management**
   - Target information storage
   - Chain-specific target tracking
   - Target type indexing
   - Active status tracking

2. **Access Control**
   - REGISTRAR_ROLE: Can register targets
   - VALIDATOR_ROLE: Can validate targets
   - ADMIN_ROLE: Protocol administration

3. **Storage Structures**
```solidity
mapping(address => Target) private targets;
mapping(uint16 => address[]) private chainTargets;
mapping(TargetType => address[]) private typeTargets;
mapping(bytes32 => bool) private validEmitters;
```

4. **Core Functionality**
   - Target registration with validation
   - Cross-chain target management
   - Target type classification
   - Status management
   - Query functions

5. **Security Requirements**
   - Target validation
   - Cross-chain verification
   - Access control
   - Status verification

6. **Gas Optimization Requirements**
   - Efficient target lookup
   - Optimized storage patterns
   - Minimal state changes

### Implementation Requirements

1. **Target Registration**
   - Validate target information
   - Store target data
   - Update indices
   - Emit events

2. **Target Management**
   - Status updates
   - Type management
   - Chain registration
   - Validation checks

3. **Query Functions**
   - Target information retrieval
   - Chain-specific queries
   - Type-based queries
   - Validation checks

4. **Administrative Functions**
   - Emergency controls
   - Chain management
   - Type management

### Testing Considerations
1. Registration scenarios
2. Cross-chain validation
3. Type management
4. Access control
5. Gas optimization