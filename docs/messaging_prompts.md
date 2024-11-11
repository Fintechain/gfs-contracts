# Smart Contract Development Prompt Template

## Contract Name: [Insert Contract Name]

## Interface: [Insert Interface Name, e.g., IISO20022Messaging]

## Description:
[Provide a brief description of the contract's purpose and functionality]

## Requirements:
1. Implement all functions defined in the [Interface Name] interface.
2. Ensure compatibility with Solidity version 0.8.0 or higher.
3. Include comprehensive NatSpec comments for all functions and state variables.
4. Implement appropriate access control mechanisms (e.g., Ownable, Role-based access control).
5. Include events for all significant state changes.
6. Optimize for gas efficiency where possible.
7. Include error messages for require statements to aid in debugging.

## State Variables:
[List any additional state variables required beyond those implied by the interface]

## Functions to Implement:
[List all functions from the interface, including their signatures]

## Additional Functions:
[List any additional helper or internal functions that may be needed]

## Security Considerations:
1. Implement checks for integer overflow/underflow.
2. Validate all input parameters.
3. Use SafeMath library for arithmetic operations if using Solidity < 0.8.0.
4. Implement re-entrancy guards where necessary.
5. Avoid using tx.origin for authentication.

## Testing Requirements:
1. Write unit tests for all public and external functions.
2. Include both positive and negative test cases.
3. Test for edge cases and potential attack vectors.
4. Achieve 100% code coverage.

## Deployment Considerations:
1. Create a deployment script using hardhat-deploy.
2. Include any necessary constructor parameters in the deployment script.
3. Consider implementing upgradeability patterns if the contract may need future updates.

## Documentation:
1. Include inline comments explaining complex logic.
2. Provide a README.md file explaining the contract's purpose, functions, and any special considerations.

## Additional Notes:
[Include any other relevant information or special requirements for this specific contract]

---

Please implement the smart contract based on these requirements and guidelines. Ensure that the contract is thoroughly tested and ready for review before submission.