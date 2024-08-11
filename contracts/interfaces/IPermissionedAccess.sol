// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * @title IPermissionedAccess
 * @dev Interface for permissioned access control (for Institutional Zones)
 */
interface IPermissionedAccess {
    /**
     * @dev Emitted when a role is granted to an account
     * @param role The role that was granted
     * @param account The account that was granted the role
     * @param grantor The account that granted the role
     */
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed grantor);

    /**
     * @dev Emitted when a role is revoked from an account
     * @param role The role that was revoked
     * @param account The account that was revoked the role
     * @param revoker The account that revoked the role
     */
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed revoker);

    /**
     * @dev Grants a role to an account
     * @param role The role to grant
     * @param account The account to which the role is granted
     */
    function grantRole(bytes32 role, address account) external;

    /**
     * @dev Revokes a role from an account
     * @param role The role to revoke
     * @param account The account from which the role is revoked
     */
    function revokeRole(bytes32 role, address account) external;

    /**
     * @dev Checks if an account has a specific role
     * @param role The role to check
     * @param account The account to check
     * @return bool True if the account has the role, false otherwise
     */
    function hasRole(bytes32 role, address account) external view returns (bool);

    /**
     * @dev Gets the admin role for a specific role
     * @param role The role to query
     * @return bytes32 The admin role for the queried role
     */
    function getRoleAdmin(bytes32 role) external view returns (bytes32);
}
