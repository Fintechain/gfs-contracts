// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ITargetRegistry
 * @notice Interface for managing registered targets (institutions and contracts)
 * that can participate in ISO20022 message exchange
 */
interface ITargetRegistry {
    /// @notice Type of registered target
    enum TargetType {
        CONTRACT,      // Smart contract target
        INSTITUTION,   // Financial institution
        BOTH          // Both contract and institution
    }

    /// @notice Structure for target information
    struct Target {
        address addr;            // Target address
        uint16 chainId;         // Chain ID where target is located
        TargetType targetType;  // Type of target
        bool isActive;          // Whether target is active
        bytes metadata;         // Additional target information
    }

    /// @notice Emitted when a new target is registered
    event TargetRegistered(
        address indexed addr,
        uint16 indexed chainId,
        TargetType targetType
    );

    /// @notice Emitted when a target's status is updated
    event TargetStatusUpdated(
        address indexed addr,
        bool isActive
    );

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
    ) external;

    /**
     * @notice Update a target's active status
     * @param addr Target address
     * @param isActive New active status
     */
    function updateTargetStatus(address addr, bool isActive) external;

    /**
     * @notice Get target information
     * @param addr Target address
     * @return target Target information
     */
    function getTarget(address addr) external view returns (Target memory);

    /**
     * @notice Check if a target is registered and active
     * @param addr Target address
     * @param chainId Chain ID
     * @return isValid Whether target is valid
     */
    function isValidTarget(
        address addr,
        uint16 chainId
    ) external view returns (bool);

    /**
     * @notice Get all registered targets for a chain
     * @param chainId Chain ID
     * @return targets Array of target addresses
     */
    function getTargetsByChain(
        uint16 chainId
    ) external view returns (address[] memory);

    /**
     * @notice Get all targets of a specific type
     * @param targetType Type of targets to retrieve
     * @return targets Array of target addresses
     */
    function getTargetsByType(
        TargetType targetType
    ) external view returns (address[] memory);
}