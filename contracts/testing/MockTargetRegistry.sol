// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockTargetRegistry
 * @notice Mock implementation of the target registry contract for testing
 * @dev Simulates registry functionality for managing valid message targets
 */
contract MockTargetRegistry {
    // Target registration tracking
    struct Target {
        address addr;
        uint16 chainId;
        uint8 targetType;
        bool isActive;
        bytes metadata;
    }
    
    mapping(address => Target) private targets;
    mapping(uint16 => address[]) private chainTargets;
    mapping(uint8 => address[]) private typeTargets;

    event TargetRegistered(
        address indexed addr,
        uint16 indexed chainId,
        uint8 targetType
    );

    event TargetStatusUpdated(
        address indexed addr,
        bool isActive
    );

    /**
     * @notice Set a target as valid for testing
     * @param addr Target address
     * @param chainId Chain ID where target exists
     * @param isValid Whether target should be valid
     */
    function setValidTarget(
        address addr,
        uint16 chainId,
        bool isValid
    ) external {
        if (isValid && targets[addr].addr == address(0)) {
            // New target registration
            targets[addr] = Target({
                addr: addr,
                chainId: chainId,
                targetType: 0, // Default type
                isActive: true,
                metadata: ""
            });
            
            chainTargets[chainId].push(addr);
            emit TargetRegistered(addr, chainId, 0);
        } else if (targets[addr].addr != address(0)) {
            // Update existing target
            targets[addr].isActive = isValid;
            emit TargetStatusUpdated(addr, isValid);
        }
    }

    /**
     * @notice Check if a target is valid
     * @param addr Target address
     * @param chainId Chain ID to check
     * @return isValid Whether target is valid
     */
    function isValidTarget(
        address addr,
        uint16 chainId
    ) external view returns (bool) {
        Target memory target = targets[addr];
        return target.addr != address(0) && 
               target.chainId == chainId && 
               target.isActive;
    }

    /**
     * @notice Get all targets for a specific chain
     * @param chainId Chain ID to query
     * @return Array of target addresses
     */
    function getTargetsByChain(
        uint16 chainId
    ) external view returns (address[] memory) {
        return chainTargets[chainId];
    }

    /**
     * @notice Get target information
     * @param addr Target address
     * @return Target struct
     */
    function getTarget(
        address addr
    ) external view returns (Target memory) {
        return targets[addr];
    }
}