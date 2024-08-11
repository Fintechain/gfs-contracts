// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20FlashMintUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title GovernanceToken
 * @dev This contract implements a governance token with upgradeability, pausing, minting, burning, flash minting,
 * permit functionality, and voting capabilities. It uses OpenZeppelin's upgradeable contracts.
 */
contract GovernanceToken is 
    Initializable, 
    ERC20Upgradeable, 
    ERC20BurnableUpgradeable, 
    ERC20PausableUpgradeable, 
    AccessControlUpgradeable, 
    ERC20PermitUpgradeable, 
    ERC20VotesUpgradeable, 
    ERC20FlashMintUpgradeable, 
    UUPSUpgradeable 
{
    // Define roles with keccak256 hash
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract with the specified name and symbol, and set up the roles.
     * @param name The name of the token.
     * @param symbol The symbol of the token.
     * @param defaultAdmin The address to be granted the default admin role.
     * @param pauser The address to be granted the pauser role.
     * @param minter The address to be granted the minter role.
     * @param upgrader The address to be granted the upgrader role.
     */
    function initialize(
        string memory name, 
        string memory symbol, 
        address defaultAdmin, 
        address pauser, 
        address minter, 
        address upgrader
    ) initializer public {
        __ERC20_init(name, symbol);
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __AccessControl_init();
        __ERC20Permit_init(name);
        __ERC20Votes_init();
        __ERC20FlashMint_init();
        __UUPSUpgradeable_init();

        // Grant roles to the specified addresses
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(UPGRADER_ROLE, upgrader);
    }

    /**
     * @dev Pauses all token transfers.
     * Can only be called by accounts with the PAUSER_ROLE.
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     * Can only be called by accounts with the PAUSER_ROLE.
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Mints new tokens to the specified address.
     * Can only be called by accounts with the MINTER_ROLE.
     * @param to The address to receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @dev Authorizes an upgrade to a new implementation.
     * Can only be called by accounts with the UPGRADER_ROLE.
     * @param newImplementation The address of the new implementation.
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}

    // The following functions are overrides required by Solidity.

    /**
     * @dev Overrides the _update function to handle voting power updates during token transfers.
     * @param from The address tokens are transferred from.
     * @param to The address tokens are transferred to.
     * @param value The amount of tokens transferred.
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20Upgradeable, ERC20PausableUpgradeable, ERC20VotesUpgradeable)
    {
        super._update(from, to, value);
    }

    /**
     * @dev Returns the current nonce for the specified owner.
     * This value is used for permit functionality.
     * @param owner The address to check the nonce for.
     * @return The current nonce of the owner.
     */
    function nonces(address owner)
        public
        view
        override(ERC20PermitUpgradeable, NoncesUpgradeable)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
