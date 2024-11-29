# Integration tests we should implement. Let me analyze the key components and interactions:

1. Local Message Processing Tests:

```typescript
// Base Local Message Tests
- Should successfully submit and process a PACS008 message with minimum amount
- Should successfully submit and process a PACS008 message with maximum amount
- Should handle multiple messages in sequence from the same sender
- Should process messages from different senders correctly
- Should maintain correct message state transitions (PENDING -> DELIVERED -> PROCESSED)

// Fee-Related Tests
- Should calculate correct fees for different payload sizes
- Should refund excess fees correctly
- Should fail when insufficient fees are provided
- Should track gas usage correctly for local message processing

// Validation Tests
- Should reject messages with invalid instruction IDs
- Should reject messages with zero amounts
- Should reject messages with amounts below minimum
- Should reject messages with amounts above maximum
- Should reject messages where debtor and creditor are the same
- Should reject messages with invalid token addresses
- Should prevent duplicate message processing
- Should validate handler addresses correctly

// Error Handling & Recovery
- Should handle failed message processing gracefully
- Should allow message retry after failure
- Should allow message cancellation in valid states
- Should prevent unauthorized message cancellation
- Should handle emergency cancellation by admin correctly

// Role-Based Access Tests
- Should enforce processor role requirements
- Should enforce admin role requirements for configuration changes
- Should enforce operator role requirements
- Should enforce emergency role requirements for critical operations

// Event Emission Tests
- Should emit correct events for message submission
- Should emit correct events for message processing
- Should emit correct events for state changes
- Should include all relevant information in emitted events

// Protocol Component Integration
- Should correctly integrate MessageRegistry updates
- Should correctly integrate MessageProtocol validations
- Should correctly integrate MessageRouter routing
- Should verify SettlementController integration
- Should handle upgrades of protocol components correctly
```

2. Cross-Chain Message Processing Tests:

```typescript
// Basic Cross-Chain Tests
- Should submit messages to different target chains successfully
- Should calculate cross-chain fees correctly
- Should handle Wormhole integration correctly
- Should track cross-chain message delivery status

// Chain-Specific Tests
- Should enforce correct chain-specific gas limits
- Should handle different chain configurations
- Should validate target chains correctly
- Should handle chain ID verification properly

// Fee Structure Tests
- Should calculate correct cross-chain processing fees
- Should include Wormhole fees correctly
- Should handle fee variations across different chains
- Should refund excess fees for failed cross-chain submissions

// Cross-Chain Security
- Should validate cross-chain message formats
- Should prevent unauthorized cross-chain calls
- Should handle cross-chain replay protection
- Should validate target contract addresses across chains

// Error Handling
- Should handle failed cross-chain deliveries
- Should allow cross-chain message retry
- Should handle network-specific errors
- Should implement proper timeout mechanisms
```

3. System-Wide Integration Tests:

```typescript
// Performance Tests
- Should handle high message volumes efficiently
- Should process concurrent messages correctly
- Should maintain performance under load
- Should handle large payload sizes efficiently

// State Management
- Should maintain consistent state across components
- Should handle system pausing correctly
- Should resume operations properly after pause
- Should maintain message order integrity

// Security Tests
- Should prevent reentrancy attacks
- Should handle contract upgrades securely
- Should maintain proper access control across components
- Should protect against common attack vectors

// Recovery Scenarios
- Should recover from system-wide failures
- Should handle emergency shutdowns properly
- Should maintain data integrity during recoveries
- Should handle partial system failures
```

This test suite covers:
1. Basic functionality
2. Error cases and edge conditions
3. Security aspects
4. System integration points
5. Performance considerations
6. Recovery scenarios

To implement these tests effectively, we should:
1. Create separate test files for each major category
2. Use shared fixtures for common setup
3. Implement proper mocking for cross-chain components
4. Add comprehensive logging for debugging
5. Include gas usage tracking and optimization metrics
