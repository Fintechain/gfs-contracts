// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IMessageHandler {
    /**
     * @notice Handle an ISO20022 message
     * @param messageId Unique identifier of the message
     * @param payload Encoded message data
     * @return result Handler result, encoded based on ProcessingAction
     * For SETTLEMENT_REQUIRED returns abi.encode(settlementId)
     * For NO_SETTLEMENT returns abi.encode(success)
     */
    function handleMessage(
        bytes32 messageId,
        bytes calldata payload
    ) external returns (bytes memory result);

    /**
     * @notice Get supported message types
     * @return messageTypes Array of supported message types
     */
    function getSupportedMessageTypes() 
        external view returns (bytes32[] memory);
}