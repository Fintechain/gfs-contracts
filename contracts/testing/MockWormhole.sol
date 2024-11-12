// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockWormhole
 * @notice Mock implementation of the Wormhole core contract for testing
 * @dev Simulates core Wormhole functionality like message publishing and fee management
 */
contract MockWormhole {
    // Track published messages
    struct PublishedMessage {
        uint32 nonce;
        bytes payload;
        uint8 consistencyLevel;
        uint64 sequence;
    }
    
    PublishedMessage[] public messages;
    uint256 private _messageFee;
    mapping(uint64 => bool) public isMessagePublished;
    uint64 private _currentSequence;

    event MessagePublished(
        uint32 nonce,
        bytes payload,
        uint8 consistencyLevel,
        uint64 sequence
    );

    /**
     * @notice Set the message fee for testing
     * @param fee New fee amount
     */
    function setMessageFee(uint256 fee) external {
        _messageFee = fee;
    }

    /**
     * @notice Get the current message fee
     * @return Current fee amount
     */
    function messageFee() external view returns (uint256) {
        return _messageFee;
    }

    /**
     * @notice Mock message publishing
     * @param nonce Message nonce
     * @param payload Message payload
     * @param consistencyLevel Required consistency level
     * @return sequence Sequence number of the published message
     */
    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external payable returns (uint64 sequence) {
        require(msg.value >= _messageFee, "MockWormhole: Insufficient fee");
        
        _currentSequence++;
        sequence = _currentSequence;
        
        messages.push(PublishedMessage({
            nonce: nonce,
            payload: payload,
            consistencyLevel: consistencyLevel,
            sequence: sequence
        }));
        
        isMessagePublished[sequence] = true;
        
        emit MessagePublished(nonce, payload, consistencyLevel, sequence);
        return sequence;
    }

    /**
     * @notice Get the next sequence number for a specific emitter
     * @param emitter Address of the emitter
     * @return Next sequence number
     */
    function nextSequence(address emitter) external view returns (uint64) {
        return _currentSequence + 1;
    }

    /**
     * @notice Helper to verify if a message exists
     * @param sequence Sequence number to check
     * @return exists Whether message exists
     */
    function messageExists(uint64 sequence) external view returns (bool) {
        return isMessagePublished[sequence];
    }
}
