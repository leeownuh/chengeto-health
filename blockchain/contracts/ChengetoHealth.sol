// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
 * ChengetoHealth
 * Permissioned blockchain accountability ledger for CHENGETO Health platform.
 * Records care events, alerts, and escalation actions immutably.
 */

contract ChengetoHealth {
    // ============ Enums ============
    
    enum EventType {
        CHECKIN_COMPLETED,
        CHECKIN_MISSED,
        ALERT_TRIGGERED,
        ALERT_ACKNOWLEDGED,
        ALERT_ESCALATED,
        ALERT_RESOLVED,
        CARE_PLAN_CHANGED,
        DEVICE_PAIRED,
        PATIENT_ENROLLED
    }
    
    enum AlertLevel {
        LEVEL_0,
        LEVEL_1,
        LEVEL_2,
        LEVEL_3
    }
    
    // ============ Structs ============
    
    struct CareEvent {
        bytes32 eventId;
        bytes32 patientId;
        bytes32 actorId;
        EventType eventType;
        uint256 timestamp;
        bytes32 dataHash;        // Hash of off-chain data
        AlertLevel escalationLevel;
        bool verified;
        bytes32 proximityProof;  // BLE/NFC verification hash
    }
    
    struct PatientRecord {
        bytes32 patientId;
        address registeredBy;
        uint256 registeredAt;
        bool active;
        uint256 eventCount;
    }
    
    struct ActorRecord {
        bytes32 actorId;
        address walletAddress;
        uint8 role;              // 0=admin, 1=chw, 2=caregiver, 3=clinician
        bool active;
        uint256 registeredAt;
    }
    
    // ============ State Variables ============
    
    address public owner;
    address public pendingOwner;
    
    // Mappings
    mapping(bytes32 => CareEvent) public careEvents;
    mapping(bytes32 => PatientRecord) public patients;
    mapping(bytes32 => ActorRecord) public actors;
    mapping(address => bytes32) public addressToActor;
    
    // Event indices for querying
    mapping(bytes32 => bytes32[]) public patientEvents;  // patientId -> eventIds
    mapping(bytes32 => bytes32[]) public actorEvents;    // actorId -> eventIds
    
    // Counters
    uint256 public totalEvents;
    uint256 public totalPatients;
    uint256 public totalActors;
    
    // Authorized registrars (can add events)
    mapping(address => bool) public authorizedRegistrars;
    
    // Paused state
    bool public paused;
    
    // ============ Events ============
    
    event CareEventRecorded(
        bytes32 indexed eventId,
        bytes32 indexed patientId,
        bytes32 indexed actorId,
        EventType eventType,
        uint256 timestamp
    );
    
    event PatientRegistered(
        bytes32 indexed patientId,
        address indexed registeredBy,
        uint256 timestamp
    );
    
    event ActorRegistered(
        bytes32 indexed actorId,
        address indexed walletAddress,
        uint8 role,
        uint256 timestamp
    );
    
    event RegistrarAdded(address indexed registrar);
    event RegistrarRemoved(address indexed registrar);
    event ContractPaused(address indexed by);
    event ContractUnpaused(address indexed by);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }
    
    modifier onlyAuthorized() {
        require(authorizedRegistrars[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier whenPaused() {
        require(paused, "Contract is not paused");
        _;
    }
    
    modifier actorExists(bytes32 _actorId) {
        require(actors[_actorId].active, "Actor does not exist");
        _;
    }
    
    modifier patientExists(bytes32 _patientId) {
        require(patients[_patientId].active, "Patient does not exist");
        _;
    }
    
    // ============ Constructor ============
    
    constructor() {
        owner = msg.sender;
        authorizedRegistrars[msg.sender] = true;
        paused = false;
    }
    
    // ============ External Functions ============
    
    /**
     * @dev Register a new patient
     * @param _patientId Unique patient identifier (hashed)
     */
    function registerPatient(bytes32 _patientId)
        external
        onlyAuthorized
        whenNotPaused
    {
        require(!patients[_patientId].active, "Patient already registered");
        
        patients[_patientId] = PatientRecord({
            patientId: _patientId,
            registeredBy: msg.sender,
            registeredAt: block.timestamp,
            active: true,
            eventCount: 0
        });
        
        totalPatients++;
        
        emit PatientRegistered(_patientId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Register a new actor (caregiver, CHW, clinician, etc.)
     * @param _actorId Unique actor identifier (hashed)
     * @param _walletAddress Ethereum address of the actor
     * @param _role Role of the actor (0=admin, 1=chw, 2=caregiver, 3=clinician)
     */
    function registerActor(
        bytes32 _actorId,
        address _walletAddress,
        uint8 _role
    )
        external
        onlyAuthorized
        whenNotPaused
    {
        require(!actors[_actorId].active, "Actor already registered");
        require(_walletAddress != address(0), "Invalid wallet address");
        require(_role <= 3, "Invalid role");
        
        actors[_actorId] = ActorRecord({
            actorId: _actorId,
            walletAddress: _walletAddress,
            role: _role,
            active: true,
            registeredAt: block.timestamp
        });
        
        addressToActor[_walletAddress] = _actorId;
        totalActors++;
        
        emit ActorRegistered(_actorId, _walletAddress, _role, block.timestamp);
    }
    
    /**
     * @dev Record a care event
     * @param _eventId Unique event identifier
     * @param _patientId Patient identifier
     * @param _actorId Actor who performed the action
     * @param _eventType Type of event
     * @param _dataHash Hash of the off-chain data
     * @param _escalationLevel Current escalation level (for alerts)
     * @param _proximityProof BLE/NFC proximity verification hash
     */
    function recordCareEvent(
        bytes32 _eventId,
        bytes32 _patientId,
        bytes32 _actorId,
        EventType _eventType,
        bytes32 _dataHash,
        AlertLevel _escalationLevel,
        bytes32 _proximityProof
    )
        external
        onlyAuthorized
        whenNotPaused
        patientExists(_patientId)
        actorExists(_actorId)
    {
        require(careEvents[_eventId].eventId == bytes32(0), "Event already exists");
        
        CareEvent memory newEvent = CareEvent({
            eventId: _eventId,
            patientId: _patientId,
            actorId: _actorId,
            eventType: _eventType,
            timestamp: block.timestamp,
            dataHash: _dataHash,
            escalationLevel: _escalationLevel,
            verified: true,
            proximityProof: _proximityProof
        });
        
        careEvents[_eventId] = newEvent;
        patientEvents[_patientId].push(_eventId);
        actorEvents[_actorId].push(_eventId);
        
        patients[_patientId].eventCount++;
        totalEvents++;
        
        emit CareEventRecorded(
            _eventId,
            _patientId,
            _actorId,
            _eventType,
            block.timestamp
        );
    }
    
    /**
     * @dev Record a check-in event (convenience function)
     */
    function recordCheckIn(
        bytes32 _eventId,
        bytes32 _patientId,
        bytes32 _caregiverId,
        bytes32 _dataHash,
        bytes32 _proximityProof,
        bool _completed
    )
        external
        onlyAuthorized
        whenNotPaused
    {
        EventType eventType = _completed ? EventType.CHECKIN_COMPLETED : EventType.CHECKIN_MISSED;
        
        this.recordCareEvent(
            _eventId,
            _patientId,
            _caregiverId,
            eventType,
            _dataHash,
            AlertLevel.LEVEL_0,
            _proximityProof
        );
    }
    
    /**
     * @dev Record an alert event
     */
    function recordAlert(
        bytes32 _eventId,
        bytes32 _patientId,
        bytes32 _actorId,
        bytes32 _dataHash,
        AlertLevel _escalationLevel,
        EventType _eventType
    )
        external
        onlyAuthorized
        whenNotPaused
    {
        this.recordCareEvent(
            _eventId,
            _patientId,
            _actorId,
            _eventType,
            _dataHash,
            _escalationLevel,
            bytes32(0)
        );
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get care event by ID
     */
    function getCareEvent(bytes32 _eventId)
        external
        view
        returns (CareEvent memory)
    {
        return careEvents[_eventId];
    }
    
    /**
     * @dev Get patient event count
     */
    function getPatientEventCount(bytes32 _patientId)
        external
        view
        returns (uint256)
    {
        return patients[_patientId].eventCount;
    }
    
    /**
     * @dev Get patient events (paginated)
     */
    function getPatientEvents(
        bytes32 _patientId,
        uint256 _start,
        uint256 _limit
    )
        external
        view
        returns (bytes32[] memory)
    {
        bytes32[] storage events = patientEvents[_patientId];
        uint256 length = events.length;
        
        if (_start >= length) {
            return new bytes32[](0);
        }
        
        uint256 end = _start + _limit;
        if (end > length) {
            end = length;
        }
        
        bytes32[] memory result = new bytes32[](end - _start);
        for (uint256 i = _start; i < end; i++) {
            result[i - _start] = events[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get actor events (paginated)
     */
    function getActorEvents(
        bytes32 _actorId,
        uint256 _start,
        uint256 _limit
    )
        external
        view
        returns (bytes32[] memory)
    {
        bytes32[] storage events = actorEvents[_actorId];
        uint256 length = events.length;
        
        if (_start >= length) {
            return new bytes32[](0);
        }
        
        uint256 end = _start + _limit;
        if (end > length) {
            end = length;
        }
        
        bytes32[] memory result = new bytes32[](end - _start);
        for (uint256 i = _start; i < end; i++) {
            result[i - _start] = events[i];
        }
        
        return result;
    }
    
    /**
     * @dev Verify event integrity
     * @param _eventId Event to verify
     * @param _dataHash Hash to compare against stored hash
     */
    function verifyEventIntegrity(bytes32 _eventId, bytes32 _dataHash)
        external
        view
        returns (bool)
    {
        return careEvents[_eventId].dataHash == _dataHash;
    }
    
    /**
     * @dev Get contract statistics
     */
    function getStatistics()
        external
        view
        returns (
            uint256 _totalEvents,
            uint256 _totalPatients,
            uint256 _totalActors,
            uint256 _blockNumber
        )
    {
        return (totalEvents, totalPatients, totalActors, block.number);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Add authorized registrar
     */
    function addRegistrar(address _registrar)
        external
        onlyOwner
    {
        authorizedRegistrars[_registrar] = true;
        emit RegistrarAdded(_registrar);
    }
    
    /**
     * @dev Remove authorized registrar
     */
    function removeRegistrar(address _registrar)
        external
        onlyOwner
    {
        authorizedRegistrars[_registrar] = false;
        emit RegistrarRemoved(_registrar);
    }
    
    /**
     * @dev Deactivate patient
     */
    function deactivatePatient(bytes32 _patientId)
        external
        onlyAuthorized
    {
        patients[_patientId].active = false;
    }
    
    /**
     * @dev Deactivate actor
     */
    function deactivateActor(bytes32 _actorId)
        external
        onlyAuthorized
    {
        actors[_actorId].active = false;
    }
    
    /**
     * @dev Pause contract
     */
    function pause()
        external
        onlyOwner
        whenNotPaused
    {
        paused = true;
        emit ContractPaused(msg.sender);
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause()
        external
        onlyOwner
        whenPaused
    {
        paused = false;
        emit ContractUnpaused(msg.sender);
    }
    
    /**
     * @dev Transfer ownership
     */
    function transferOwnership(address _newOwner)
        external
        onlyOwner
    {
        require(_newOwner != address(0), "Invalid new owner");
        pendingOwner = _newOwner;
    }
    
    /**
     * @dev Accept ownership transfer
     */
    function acceptOwnership()
        external
    {
        require(msg.sender == pendingOwner, "Not pending owner");
        
        address previousOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        
        authorizedRegistrars[previousOwner] = false;
        authorizedRegistrars[owner] = true;
        
        emit OwnershipTransferred(previousOwner, owner);
    }
    
    /**
     * @dev Renounce ownership
     */
    function renounceOwnership()
        external
        onlyOwner
    {
        address previousOwner = owner;
        owner = address(0);
        authorizedRegistrars[previousOwner] = false;
        
        emit OwnershipTransferred(previousOwner, address(0));
    }
}
