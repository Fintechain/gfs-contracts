pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ParticipantRegistry is IParticipantRegistry, AccessControl, Pausable {
    using Counters for Counters.Counter;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    mapping(address => Participant) private participants;
    Counters.Counter private participantCount;

    address[] private participantAddresses;

    event ParticipantRegistered(address indexed participantAddress, string name);
    event ParticipantStatusUpdated(address indexed participantAddress, ParticipantStatus newStatus);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
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
        participantCount.increment();

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
        return participantCount.current();
    }

    // Additional helper functions

    function getAllParticipants() external view returns (Participant[] memory) {
        Participant[] memory allParticipants = new Participant[](participantCount.current());
        for (uint i = 0; i < participantCount.current(); i++) {
            allParticipants[i] = participants[participantAddresses[i]];
        }
        return allParticipants;
    }

    function isActiveParticipant(address participantAddress) public view returns (bool) {
        return participants[participantAddress].status == ParticipantStatus.Active;
    }

    // Admin functions

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
}