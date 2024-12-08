// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../interfaces/IMessageHandler.sol";
import "../../interfaces/ISettlementController.sol";

/**
 * @title PACS008Handler
 * @notice Handles ISO20022 pacs.008 (FIToFICustomerCreditTransfer) messages
 * @dev Processes credit transfers between financial institutions
 */
contract PACS008Handler is IMessageHandler, AccessControl, Pausable, ReentrancyGuard {
    // Custom errors
    error InvalidPayloadLength();
    error InvalidMessageFormat();
    error InvalidAmount();
    error SettlementFailed();

    // Role definitions
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");

    // Constants
    bytes32 public constant MESSAGE_TYPE_PACS008 = keccak256("pacs.008");
    uint256 private constant MINIMUM_AMOUNT = 1;
    uint256 private constant MAXIMUM_AMOUNT = 1_000_000/* _000_000 */ ether; // 1 million

    // Settlement controller
    ISettlementController public immutable settlementController;

    // Track processed messages to prevent duplicates
    mapping(bytes32 => bool) public processedMessages;

     // Field selectors
    bytes4 private constant DEBTOR_AGENT_SELECTOR = bytes4(keccak256("debtorAgent"));
    bytes4 private constant CREDITOR_AGENT_SELECTOR = bytes4(keccak256("creditorAgent"));
    bytes4 private constant TOKEN_SELECTOR = bytes4(keccak256("token"));
    bytes4 private constant AMOUNT_SELECTOR = bytes4(keccak256("amount"));
    bytes4 private constant INSTRUCTION_ID_SELECTOR = bytes4(keccak256("instructionId"));

    // Events
    event CreditTransferProcessed(
        bytes32 indexed messageId,
        bytes32 indexed settlementId,
        address debtorAgent,
        address creditorAgent,
        address token,
        uint256 amount
    );

    /**
     * @notice Message payload structure for PACS.008
     * @dev Packed struct to optimize gas usage
     */
    struct PACS008Payload {
        address debtorAgent;      // Sending institution
        address creditorAgent;    // Receiving institution
        address token;           // Token contract address
        uint256 amount;          // Transfer amount
        bytes32 instructionId;   // Unique instruction identifier
    }

    /**
     * @notice Contract constructor
     * @param _settlementController Address of the settlement controller
     */
    constructor(address _settlementController) {
        require(_settlementController != address(0), "Invalid settlement controller");
        settlementController = ISettlementController(_settlementController);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROCESSOR_ROLE, msg.sender);
    }

    /**
     * @inheritdoc IMessageHandler
     */
    function handleMessage(
        bytes32 messageId,
        bytes calldata payload
    ) external override whenNotPaused nonReentrant returns (bytes memory) {
        require(hasRole(PROCESSOR_ROLE, msg.sender), "Unauthorized processor");
        require(!processedMessages[messageId], "Message already processed");


        // Validate and decode payload
        PACS008Payload memory creditTransfer = _decodeAndValidatePayload(payload);

        // Process settlement
        bytes32 settlementId = _processSettlement(messageId, creditTransfer);
        
        // Mark message as processed
        processedMessages[messageId] = true;

        emit CreditTransferProcessed(
            messageId,
            settlementId,
            creditTransfer.debtorAgent,
            creditTransfer.creditorAgent,
            creditTransfer.token,
            creditTransfer.amount
        );

        return abi.encode(settlementId);
    }

    /**
     * @notice Decode and validate the message payload
     * @param payload Raw message payload
     * @return decoded Decoded PACS008Payload struct
     */
    function _decodeAndValidatePayload(
        bytes calldata payload
    ) private pure returns (PACS008Payload memory decoded) {
        // Each field is 36 bytes (4 bytes selector + 32 bytes value)
        // Total: 5 fields * 36 bytes = 180 bytes
        if (payload.length != 180) revert InvalidPayloadLength();

        // Initialize variables
        address debtorAgent;
        address creditorAgent;
        address token;
        uint256 amount;
        bytes32 instructionId;

        // Parse each field
        for (uint256 i = 0; i < payload.length; i += 36) {
            bytes4 selector = bytes4(payload[i:i + 4]);
            bytes32 value = bytes32(payload[i + 4:i + 36]);

            if (selector == DEBTOR_AGENT_SELECTOR) {
                debtorAgent = address(uint160(uint256(value)));
            } else if (selector == CREDITOR_AGENT_SELECTOR) {
                creditorAgent = address(uint160(uint256(value)));
            } else if (selector == TOKEN_SELECTOR) {
                token = address(uint160(uint256(value)));
            } else if (selector == AMOUNT_SELECTOR) {
                amount = uint256(value);
            } else if (selector == INSTRUCTION_ID_SELECTOR) {
                instructionId = value;
            }
        }

        // Validate addresses
        if (debtorAgent == address(0) ||
            creditorAgent == address(0) ||
            token == address(0)) {
            revert InvalidMessageFormat();
        }

        // Validate amount
        if (amount < MINIMUM_AMOUNT ||
            amount > MAXIMUM_AMOUNT) {
            revert InvalidAmount();
        }

        decoded = PACS008Payload({
            debtorAgent: debtorAgent,
            creditorAgent: creditorAgent,
            token: token,
            amount: amount,
            instructionId: instructionId
        });

        return decoded;
    }
    
    /**
     * @notice Process the settlement for a credit transfer
     * @param messageId Original message identifier
     * @param creditTransfer Decoded PACS008 payload
     * @return settlementId Generated settlement identifier
     */
    function _processSettlement(
        bytes32 messageId,
        PACS008Payload memory creditTransfer
    ) private returns (bytes32) {
        bytes32 settlementId = settlementController.processSettlement(
            messageId,
            creditTransfer.token,
            creditTransfer.amount,
            creditTransfer.creditorAgent
        );

        if (settlementId == bytes32(0)) {
            revert SettlementFailed();
        }

        return settlementId;
    }

    /**
     * @inheritdoc IMessageHandler
     */
    function getSupportedMessageTypes() 
        external pure override 
        returns (bytes32[] memory) 
    {
        bytes32[] memory types = new bytes32[](1);
        types[0] = MESSAGE_TYPE_PACS008;
        return types;
    }

    /**
     * @notice Pause the handler
     */
    function pause() external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Unauthorized");
        _pause();
    }

    /**
     * @notice Unpause the handler
     */
    function unpause() external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Unauthorized");
        _unpause();
    }
}