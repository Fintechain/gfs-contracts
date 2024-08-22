pragma solidity ^0.8.0;

/**
 * @title IParticipantRegistry
 * @dev Interface for managing participants in the decentralized RTGS system.
 */
interface IParticipantRegistry {
    
    /**
     * @dev Enumeration representing the status of a participant.
     */
    enum ParticipantStatus { Active, Suspended, Inactive }

    /**
     * @dev Structure representing a participant's information.
     * @param addr The Ethereum address of the participant.
     * @param name The name of the participant.
     * @param status The current status of the participant.
     * @param joinDate The timestamp when the participant joined.
     */
    struct Participant {
        address addr;
        string name;
        ParticipantStatus status;
        uint256 joinDate;
    }

    /**
     * @dev Registers a new participant in the system.
     * @param name The name of the participant.
     */
    function registerParticipant(string memory name) external;

    /**
     * @dev Updates the status of an existing participant.
     * @param participantAddress The address of the participant whose status is being updated.
     * @param newStatus The new status to assign to the participant.
     */
    function updateParticipantStatus(address participantAddress, ParticipantStatus newStatus) external;

    /**
     * @dev Retrieves the details of a participant.
     * @param participantAddress The address of the participant to retrieve.
     * @return The participant's details as a `Participant` struct.
     */
    function getParticipant(address participantAddress) external view returns (Participant memory);

    /**
     * @dev Returns the total number of participants in the system.
     * @return The number of participants.
     */
    function getParticipantCount() external view returns (uint256);

    /**
     * @dev Returns true if the status of the given address is active
     * @param participantAddress The address of the participant
     */
    function isActiveParticipant(address participantAddress) external view returns (bool);
}
