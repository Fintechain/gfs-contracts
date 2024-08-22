// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IParticipantRegistry.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

contract ParticipantRegistry is Initializable, AccessControlUpgradeable, PausableUpgradeable, IParticipantRegistry {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    mapping(address => Participant) private participants;
    uint256 private participantCount;
    address[] private participantAddresses;

    event ParticipantRegistered(address indexed participantAddress, string name);
    event ParticipantStatusUpdated(address indexed participantAddress, ParticipantStatus newStatus);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    modifier onlyAdminOrManager() {
        require(hasRole(ADMIN_ROLE, msg.sender) || hasRole(MANAGER_ROLE, msg.sender), "Caller is not an admin or manager");
        _;
    }

    function registerParticipant(string memory name) external override whenNotPaused {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(participants[msg.sender].addr == address(0), "Participant already registered");

        Participant memory newParticipant = Participant({
            addr: msg.sender,
            name: name,
            status: ParticipantStatus.Active,
            joinDate: block.timestamp
        });

        participants[msg.sender] = newParticipant;
        participantAddresses.push(msg.sender);
        incrementParticipantCounter();

        emit ParticipantRegistered(msg.sender, name);
    }

    function updateParticipantStatus(address participantAddress, ParticipantStatus newStatus) 
        external 
        override 
        onlyAdminOrManager 
        whenNotPaused 
    {
        require(participants[participantAddress].addr != address(0), "Participant does not exist");
        require(participants[participantAddress].status != newStatus, "New status must be different");

        participants[participantAddress].status = newStatus;

        emit ParticipantStatusUpdated(participantAddress, newStatus);
    }

    function getParticipant(address participantAddress) 
        external 
        view 
        override 
        returns (Participant memory) 
    {
        require(participants[participantAddress].addr != address(0), "Participant does not exist");
        return participants[participantAddress];
    }

    function getParticipantCount() external view override returns (uint256) {
        return participantCount;
    }

    function getAllParticipants() external view returns (Participant[] memory) {
        Participant[] memory allParticipants = new Participant[](participantCount);
        for (uint i = 0; i < participantCount; i++) {
            allParticipants[i] = participants[participantAddresses[i]];
        }
        return allParticipants;
    }

    function isActiveParticipant(address participantAddress) external view returns (bool) {
        return participants[participantAddress].status == ParticipantStatus.Active;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function addManager(address manager) external onlyRole(ADMIN_ROLE) {
        grantRole(MANAGER_ROLE, manager);
    }

    function removeManager(address manager) external onlyRole(ADMIN_ROLE) {
        revokeRole(MANAGER_ROLE, manager);
    }
    function incrementParticipantCounter() internal returns (uint256) {
        unchecked {
            return ++participantCount;
        }
    }
}
