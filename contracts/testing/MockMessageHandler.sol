// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IMessageHandler.sol";

contract MockMessageHandler is IMessageHandler {
    bytes32[] private supportedTypes;
    bytes private mockResult;
    bool private shouldRevert;

    constructor() {
        // Initialize with a default supported message type
        supportedTypes.push(bytes32("TEST_MESSAGE_TYPE"));
    }

    // Test control functions
    function setMockResult(bytes memory result) external {
        mockResult = result;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function setSupportedTypes(bytes32[] memory types) external {
        delete supportedTypes;
        for (uint i = 0; i < types.length; i++) {
            supportedTypes.push(types[i]);
        }
    }

    // Interface implementations
    function handleMessage(
        bytes32 messageId,
        bytes memory payload
    ) external view override returns (bytes memory) {
        require(!shouldRevert, "MockMessageHandler: Forced revert");
        return mockResult.length > 0 ? mockResult : payload;
    }

    function getSupportedMessageTypes() 
        external 
        view 
        override 
        returns (bytes32[] memory) 
    {
        return supportedTypes;
    }
}