// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../interfaces/ISettlementController.sol";
import "lib/wormhole-solidity-sdk/src/interfaces/IWormholeRelayer.sol";
import "lib/wormhole-solidity-sdk/src/interfaces/IWormholeReceiver.sol";

/**
 * @title WormholeSettlementReceiver
 * @notice Receives cross-chain messages and processes settlements
 */
contract WormholeSettlementReceiver is 
    IWormholeReceiver, 
    AccessControl, 
    Pausable, 
    ReentrancyGuard 
{
    // Role definitions
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    IWormholeRelayer public immutable wormholeRelayer;
    ISettlementController public immutable settlementController;

    // Mapping to store registered senders for each chain
    mapping(uint16 => bytes32) public registeredSenders;

    // Events
    event SettlementInstructionReceived(
        bytes32 messageId,
        address sender,
        address token,
        uint256 amount,
        address recipient
    );

    event RegisteredSenderUpdated(
        uint16 sourceChain,
        bytes32 sourceAddress
    );
    
    /**
     * @notice Contract constructor
     * @param _wormholeRelayer Address of the Wormhole relayer contract
     * @param _settlementController Address of the settlement controller
     */
    constructor(address _wormholeRelayer, address _settlementController) {
        require(_wormholeRelayer != address(0), "Invalid wormhole relayer");
        require(_settlementController != address(0), "Invalid settlement controller");
        
        wormholeRelayer = IWormholeRelayer(_wormholeRelayer);
        settlementController = ISettlementController(_settlementController);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    /**
     * @notice Modifier to check if sender is registered for the source chain
     */
    modifier isRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) {
        require(
            registeredSenders[sourceChain] == sourceAddress,
            "Not registered sender"
        );
        _;
    }

    /**
     * @notice Register a sender for a specific source chain
     * @param sourceChain The chain ID of the source chain
     * @param sourceAddress The sender's address on the source chain
     */
    function setRegisteredSender(
        uint16 sourceChain,
        bytes32 sourceAddress
    ) external {
        require(
            hasRole(OPERATOR_ROLE, msg.sender),
            "Caller is not an operator"
        );
        require(sourceAddress != bytes32(0), "Invalid source address");
        
        registeredSenders[sourceChain] = sourceAddress;
        
        emit RegisteredSenderUpdated(sourceChain, sourceAddress);
    }

    /**
     * @notice Receive and process Wormhole messages
     * @dev Decodes the VAA payload which contains messageId, original sender, target, and the settlement payload
     */
    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory additionalVaas,
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32 deliveryHash
    ) public payable override 
      whenNotPaused 
      nonReentrant 
      isRegisteredSender(sourceChain, sourceAddress) 
    {
        require(
            msg.sender == address(wormholeRelayer),
            "Only Wormhole relayer can call"
        );

        // Decode the VAA payload from MessageRouter
        (
            bytes32 messageId,
            address originalSender,
            address target,
            bytes memory settlementPayload
        ) = abi.decode(payload, (bytes32, address, address, bytes));

        // Verify this contract is the intended target
        require(target == address(this), "Invalid target");

        // Decode the settlement instruction from the inner payload
        (
            address token,
            uint256 amount,
            address recipient
        ) = abi.decode(settlementPayload, (address, uint256, address));

        // Process the settlement
        bytes32 settlementId = settlementController.processSettlement(
            messageId,
            token,
            amount,
            recipient
        );

        emit SettlementInstructionReceived(
            messageId,
            originalSender,
            token,
            amount,
            recipient
        );
    }

    /**
     * @notice Pause the contract
     * @dev Only callable by admin
     */
    function pause() external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not admin");
        _pause();
    }

    /**
     * @notice Unpause the contract
     * @dev Only callable by admin
     */
    function unpause() external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not admin");
        _unpause();
    }
}