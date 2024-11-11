// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../interfaces/ITargetRegistry.sol";

/**
 * @title TargetRegistry
 * @notice Implementation of target registration and management for the GFS Protocol
 */
contract TargetRegistry is ITargetRegistry, AccessControl, Pausable, ReentrancyGuard {
    // Role definitions
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    // Storage
    mapping(address => Target) private targets;
    mapping(uint16 => address[]) private chainTargets;
    mapping(TargetType => address[]) private typeTargets;
    mapping(bytes32 => bool) private validEmitters;

    // Events not in interface
    event MetadataUpdated(address indexed target, bytes metadata);
    event EmitterRegistered(bytes32 indexed emitterAddress, uint16 indexed chainId);
    event EmitterDeregistered(bytes32 indexed emitterAddress, uint16 indexed chainId);

    /**
     * @notice Contract constructor
     * @dev Sets up initial roles
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
        _grantRole(VALIDATOR_ROLE, msg.sender);
    }

    /**
     * @notice Register a new target
     * @param addr Target address
     * @param chainId Chain ID where target is located
     * @param targetType Type of target
     * @param metadata Additional target information
     */
    function registerTarget(
        address addr,
        uint16 chainId,
        TargetType targetType,
        bytes calldata metadata
    ) external override whenNotPaused nonReentrant {
        require(
            hasRole(REGISTRAR_ROLE, msg.sender),
            "TargetRegistry: Must have registrar role"
        );
        require(addr != address(0), "TargetRegistry: Invalid address");
        require(
            !isValidTarget(addr, chainId),
            "TargetRegistry: Target already registered"
        );

        targets[addr] = Target({
            addr: addr,
            chainId: chainId,
            targetType: targetType,
            isActive: true,
            metadata: metadata
        });

        chainTargets[chainId].push(addr);
        typeTargets[targetType].push(addr);

        emit TargetRegistered(addr, chainId, targetType);
    }

    /**
     * @notice Update a target's active status
     * @param addr Target address
     * @param isActive New active status
     */
    function updateTargetStatus(
        address addr,
        bool isActive
    ) external override whenNotPaused {
        require(
            hasRole(REGISTRAR_ROLE, msg.sender),
            "TargetRegistry: Must have registrar role"
        );
        require(
            targets[addr].addr != address(0),
            "TargetRegistry: Target not registered"
        );

        targets[addr].isActive = isActive;
        emit TargetStatusUpdated(addr, isActive);
    }

    /**
     * @notice Get target information
     * @param addr Target address
     * @return target Target information
     */
    function getTarget(
        address addr
    ) external view override returns (Target memory) {
        require(
            targets[addr].addr != address(0),
            "TargetRegistry: Target not registered"
        );
        return targets[addr];
    }

    /**
     * @notice Check if a target is registered and active
     * @param addr Target address
     * @param chainId Chain ID
     * @return isValid Whether target is valid
     */
    function isValidTarget(
        address addr,
        uint16 chainId
    ) public view override returns (bool) {
        Target storage target = targets[addr];
        return target.addr != address(0) &&
               target.chainId == chainId &&
               target.isActive;
    }

    /**
     * @notice Get all registered targets for a chain
     * @param chainId Chain ID
     * @return targets Array of target addresses
     */
    function getTargetsByChain(
        uint16 chainId
    ) external view override returns (address[] memory) {
        return chainTargets[chainId];
    }

    /**
     * @notice Get all targets of a specific type
     * @param targetType Type of targets to retrieve
     * @return targets Array of target addresses
     */
    function getTargetsByType(
        TargetType targetType
    ) external view override returns (address[] memory) {
        return typeTargets[targetType];
    }

    /**
     * @notice Register a cross-chain emitter
     * @param emitterAddress Emitter address as bytes32
     * @param chainId Emitter's chain ID
     */
    function registerEmitter(
        bytes32 emitterAddress,
        uint16 chainId
    ) external whenNotPaused {
        require(
            hasRole(REGISTRAR_ROLE, msg.sender),
            "TargetRegistry: Must have registrar role"
        );
        require(emitterAddress != bytes32(0), "TargetRegistry: Invalid emitter");

        validEmitters[keccak256(abi.encodePacked(emitterAddress, chainId))] = true;
        emit EmitterRegistered(emitterAddress, chainId);
    }

    /**
     * @notice Deregister a cross-chain emitter
     * @param emitterAddress Emitter address as bytes32
     * @param chainId Emitter's chain ID
     */
    function deregisterEmitter(
        bytes32 emitterAddress,
        uint16 chainId
    ) external whenNotPaused {
        require(
            hasRole(REGISTRAR_ROLE, msg.sender),
            "TargetRegistry: Must have registrar role"
        );

        validEmitters[keccak256(abi.encodePacked(emitterAddress, chainId))] = false;
        emit EmitterDeregistered(emitterAddress, chainId);
    }

    /**
     * @notice Check if an emitter is valid
     * @param emitterAddress Emitter address as bytes32
     * @param chainId Emitter's chain ID
     * @return isValid Whether emitter is valid
     */
    function isValidEmitter(
        bytes32 emitterAddress,
        uint16 chainId
    ) external view returns (bool) {
        return validEmitters[keccak256(abi.encodePacked(emitterAddress, chainId))];
    }

    /**
     * @notice Update target metadata
     * @param addr Target address
     * @param metadata New metadata
     */
    function updateTargetMetadata(
        address addr,
        bytes calldata metadata
    ) external whenNotPaused {
        require(
            hasRole(REGISTRAR_ROLE, msg.sender),
            "TargetRegistry: Must have registrar role"
        );
        require(
            targets[addr].addr != address(0),
            "TargetRegistry: Target not registered"
        );

        targets[addr].metadata = metadata;
        emit MetadataUpdated(addr, metadata);
    }

    /**
     * @notice Pause the registry
     */
    function pause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "TargetRegistry: Must have admin role"
        );
        _pause();
    }

    /**
     * @notice Unpause the registry
     */
    function unpause() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "TargetRegistry: Must have admin role"
        );
        _unpause();
    }
}