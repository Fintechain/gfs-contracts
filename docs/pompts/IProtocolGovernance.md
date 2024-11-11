# Implementation Prompt: ProtocolGovernance Contract

## Contract Context
Generate a complete implementation of the ProtocolGovernance contract that implements IProtocolGovernance interface in the GFS Protocol.

### Core Information
- **Contract Name**: ProtocolGovernance
- **Implements**: IProtocolGovernance
- **Primary Responsibility**: Manage protocol governance and upgrades
- **Dependencies**: None external
- **Related Contracts**: All protocol contracts

### Key Requirements

1. **Governance Management**
   - Proposal creation
   - Voting mechanism
   - Execution logic
   - Emergency controls

2. **Access Control**
   - GOVERNOR_ROLE: Can create proposals
   - EXECUTOR_ROLE: Can execute proposals
   - EMERGENCY_ROLE: Emergency actions

3. **Storage Structures**
```solidity
mapping(uint256 => Proposal) private proposals;
mapping(uint256 => mapping(address => bool)) private votes;
mapping(address => uint256) private votingPower;
mapping(bytes32 => bool) private executedProposals;
```

4. **Core Functionality**
   - Proposal management
   - Vote tracking
   - Execution logic
   - Emergency handling

5. **Security Requirements**
   - Voting security
   - Execution delay
   - Access control
   - Emergency safeguards

6. **Gas Optimization Requirements**
   - Efficient voting
   - Optimized execution
   - State management

### Implementation Requirements

1. **Governance Operations**
   ```solidity
   function createProposal(
       ProposalType proposalType,
       bytes calldata data
   ) external returns (uint256);

   function vote(
       uint256 proposalId,
       bool support
   ) external;

   function executeProposal(
       uint256 proposalId
   ) external returns (bool);
   ```

2. **Emergency Controls**
   ```solidity
   function executeEmergencyAction(
       bytes calldata action
   ) external returns (bool);
   ```

3. **Testing Guidelines**
   - Proposal lifecycle
   - Voting mechanics
   - Execution flows
   - Emergency scenarios

### Special Considerations

1. **Timelock Requirements**
   - Proposal delay
   - Execution delay
   - Emergency timelock

2. **Voting Rules**
   - Quorum requirements
   - Voting periods
   - Power calculation

3. **Security Measures**
   - Multi-sig requirements
   - Delay periods
   - Value limits