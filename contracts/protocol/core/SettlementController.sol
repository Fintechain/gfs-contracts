// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../../../lib/wormhole-solidity-sdk/src/WormholeRelayerSDK.sol";
import "../../interfaces/ISettlementController.sol";
import "../../interfaces/ILiquidityPool.sol";

/**
 * @title SettlementController
 * @notice Manages cross-chain settlement operations and token transfers
 */
contract SettlementController is ISettlementController, TokenSender, AccessControl, Pausable, ReentrancyGuard {
    // Role definitions
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // Dependencies
    ILiquidityPool public immutable liquidityPool;

    // Storage
    mapping(bytes32 => Settlement) private settlements;
    mapping(bytes32 => bytes32[]) private messageSettlements;
    mapping(address => mapping(uint16 => bool)) private supportedTokens;
    mapping(bytes32 => bool) private processedSettlements;

    // Events
    event TokenSupportUpdated(address token, uint16 chainId, bool supported);

    /**
     * @notice Contract constructor
     * @param _wormholeRelayer Wormhole relayer address
     * @param _tokenBridge Token bridge address
     * @param _wormhole Wormhole core contract address
     * @param _liquidityPool Liquidity pool address
     */
    constructor(
        address _wormholeRelayer,
        address _tokenBridge,
        address _wormhole,
        address _liquidityPool
    ) TokenBase(_wormholeRelayer, _tokenBridge, _wormhole) {
        liquidityPool = ILiquidityPool(_liquidityPool);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SETTLEMENT_ROLE, msg.sender);
        _grantRole(BRIDGE_ROLE, msg.sender);
    }

    /**
     * @notice Calculate fees for settlement
     * @param targetChain Target chain ID
     * @param amount Settlement amount
     * @return fee Total fee required
     */
    function quoteSettlementFee(
        uint16 targetChain,
        uint256 amount
    ) external view override returns (uint256) {
        uint256 gasLimit = 250_000;
        (uint256 deliveryCost,) = wormholeRelayer.quoteEVMDeliveryPrice(
            targetChain,
            0,
            gasLimit
        );
        return deliveryCost + wormhole.messageFee();
    }

     /**
     * @notice Initiate cross-chain settlement
     * @param messageId Associated message ID
     * @param sourceToken Source token address
     * @param targetToken Target token address
     * @param amount Amount to settle
     * @param targetChain Target chain ID
     * @param recipient Recipient address
     */
    function initiateSettlement(
        bytes32 messageId,
        address sourceToken,
        address targetToken,
        uint256 amount,
        uint16 targetChain,
        address recipient
    ) external payable override whenNotPaused nonReentrant returns (bytes32) {
        require(
            hasRole(SETTLEMENT_ROLE, msg.sender),
            "SettlementController: Must have settlement role"
        );
        require(amount > 0, "SettlementController: Invalid amount");
        require(
            supportedTokens[sourceToken][targetChain],
            "SettlementController: Token not supported"
        );

        // Generate unique settlement ID
        bytes32 settlementId = keccak256(
            abi.encodePacked(
                messageId,
                sourceToken,
                targetToken,
                amount,
                targetChain,
                recipient,
                block.timestamp
            )
        );

        require(
            !processedSettlements[settlementId],
            "SettlementController: Settlement already processed"
        );

        // Lock liquidity
        liquidityPool.lockLiquidity(sourceToken, amount, settlementId);

        // Create settlement record
        settlements[settlementId] = Settlement({
            settlementId: settlementId,
            messageId: messageId,
            sourceToken: sourceToken,
            targetToken: targetToken,
            amount: amount,
            sourceChain: uint16(block.chainid),
            targetChain: targetChain,
            sender: msg.sender,
            recipient: recipient,
            status: SettlementStatus.IN_PROGRESS,
            timestamp: block.timestamp
        });

        messageSettlements[messageId].push(settlementId);
        
        // Initiate cross-chain transfer with payload
        bytes memory payload = abi.encode(settlementId, recipient, targetToken);
        uint256 relayerFee = this.quoteSettlementFee(targetChain, amount);
        require(msg.value >= relayerFee, "SettlementController: Insufficient fee");
        
        sendTokenWithPayloadToEvm(
            targetChain,
            recipient,
            payload,
            0, // receiverValue
            250_000, // gasLimit
            sourceToken,
            amount
        );

        emit SettlementCreated(settlementId, messageId, amount);

        return settlementId;
    }

    /**
     * @notice Cancel a pending settlement
     * @param settlementId Settlement to cancel
     * @return success Whether cancellation was successful
     */
    function cancelSettlement(
        bytes32 settlementId
    ) external override returns (bool) {
        Settlement storage settlement = settlements[settlementId];
        require(
            settlement.status == SettlementStatus.PENDING,
            "SettlementController: Settlement not pending"
        );
        require(
            settlement.sender == msg.sender,
            "SettlementController: Not settlement sender"
        );

        settlement.status = SettlementStatus.CANCELLED;
        emit SettlementStatusUpdated(settlementId, SettlementStatus.CANCELLED);
        return true;
    }

    /**
     * @notice Process incoming settlement
     * @param settlementData Settlement data
     * @param sourceChain Source chain ID
     */
    function processIncomingSettlement(
        bytes calldata settlementData,
        uint16 sourceChain
    ) external override whenNotPaused {
        require(
            hasRole(BRIDGE_ROLE, msg.sender),
            "SettlementController: Must have bridge role"
        );

        (
            bytes32 settlementId,
            address recipient,
            address targetToken
        ) = abi.decode(settlementData, (bytes32, address, address));

        require(
            !processedSettlements[settlementId],
            "SettlementController: Settlement already processed"
        );

        Settlement storage settlement = settlements[settlementId];
        require(
            settlement.status == SettlementStatus.IN_PROGRESS,
            "SettlementController: Invalid settlement status"
        );

        // Process settlement
        settlement.status = SettlementStatus.COMPLETED;
        processedSettlements[settlementId] = true;

        emit SettlementStatusUpdated(settlementId, SettlementStatus.COMPLETED);
    }

    /**
     * @notice Get settlement details
     * @param settlementId Settlement identifier
     * @return settlement Settlement details
     */
    function getSettlement(
        bytes32 settlementId
    ) external view override returns (Settlement memory) {
        return settlements[settlementId];
    }

    /**
     * @notice Get all settlements for a message
     * @param messageId Message identifier
     * @return settlementIds Array of settlement IDs
     */
    function getSettlementsByMessage(
        bytes32 messageId
    ) external view override returns (bytes32[] memory) {
        return messageSettlements[messageId];
    }

    /**
     * @notice Update supported token for chain
     * @param token Token address
     * @param chainId Chain ID
     * @param supported Whether token is supported
     */
    function updateSupportedToken(
        address token,
        uint16 chainId,
        bool supported
    ) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "SettlementController: Must have admin role"
        );
        supportedTokens[token][chainId] = supported;
        emit TokenSupportUpdated(token, chainId, supported);
    }

    /**
     * @notice Pause the controller
     */
    function pause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "SettlementController: Must have admin role"
        );
        _pause();
    }

    /**
     * @notice Unpause the controller
     */
    function unpause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "SettlementController: Must have admin role"
        );
        _unpause();
    }

    /**
     * @notice Receive native tokens
     */
    receive() external payable {}
}