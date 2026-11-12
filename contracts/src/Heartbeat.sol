// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Heartbeat {
    // ---------- Owner & timer ----------

    address public owner;

    // When the owner last checked in (seconds since Jan 1, 1970)
    uint256 public lastCheckIn;

    // How long the owner has between check-ins, plus a last-chance window
    uint256 public immutable interval;
    uint256 public immutable gracePeriod;

    bytes32 public immutable fingerprint;
    string public ipfsLink;

    // ---------- Guardians ----------

    // One guardian's "card"
    struct Guardian {
        bool hasVoted;
        uint256 whenAdded;
    }

    // Iterable mapping: a list for looping, mappings for instant lookups
    address[] public guardianList;
    mapping(address => Guardian) public guardians;
    mapping(address => bool) public isGuardian;
    mapping(address => uint256) public guardianIndex;

    // ---------- Voting ----------

    uint256 public votesNeeded;
    uint256 public voteCount;
    bool public released;

    // ---------- Modifiers ----------

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not owner!");
        _;
    }

    modifier onlyGuardian() {
        require(isGuardian[msg.sender], "Not a guardian!");
        _;
    }

    modifier notExpired() {
        require(isExpired() == false, "Switch has expired!");
        _;
    }

    modifier onlyExpired() {
        require(isExpired(), "Switch is not expired!");
        _;
    }
    // ---------- Events --------------

    // Used for resetting the countdown
    event CheckedIn(uint256 timestamp);

    // Used for adding guardian to list
    event GuardianAdded(address indexed guardian);

    // Used for removing guardians from the list
    event GuardianRemoved(address indexed guardian);

    // Used to show 2 of 3 votes needed to confirm
    event VotesNeededSet(uint256 votesNeeded);

    // Show vote progress and who voted
    event VoteCast(address indexed guardian, uint256 voteCount);

    // Show Released on the screen and unlock button
    event Released(uint256 timestamp);

    // ---------- Constructor ----------

    constructor(
        uint256 _interval,
        uint256 _gracePeriod,
        bytes32 _fingerprint,
        string memory _ipfsLink,
        uint256 _votesNeeded,
        address[] memory passedInGuardianList
    ) {
        require(_fingerprint != bytes32(0), "Fingerprint is empty/not set!");
        require(bytes(_ipfsLink).length > 0, "IPFS link is empty!");
        // msg.sender is the person deploying the contract, so they become the owner
        owner = msg.sender;

        // Deploying counts as the first check-in.
        // Block times update about every 12s, so trust minutes, not seconds.
        // https://rareskills.io/learn-solidity/blockTimestamp-and-blockNumber
        lastCheckIn = block.timestamp;

        interval = _interval;
        gracePeriod = _gracePeriod;

        fingerprint = _fingerprint;
        ipfsLink = _ipfsLink;

        uint256 countGuardians = passedInGuardianList.length;
        // 50 is far above any realistic guardian set — social-recovery schemes
        // use a handful. The limit exists so an oversized array reverts clearly
        // instead of running out of gas partway through the loop.
        require(countGuardians <= 50, "Guardian count limited to 50.");

        for (uint256 g = 0; g < countGuardians; ++g) {
            address currentGuardian = passedInGuardianList[g];

            // A zero address would be a guardian nobody controls: it inflates
            // the count and can put votesNeeded permanently out of reach.
            require(currentGuardian != address(0), "Guardian cannot be the zero address!");
            require(isGuardian[currentGuardian] == false, "Already a guardian!");
            require(owner != currentGuardian, "Guardian cannot be owner!");

            // Same impl. as addGuardian()
            guardianIndex[currentGuardian] = guardianList.length;

            guardianList.push(currentGuardian);

            guardians[currentGuardian] = Guardian(false, block.timestamp);

            isGuardian[currentGuardian] = true;
            emit GuardianAdded(currentGuardian);
        }

        // Last, because it is validated against the final guardian count.
        // Same rules as setVotesNeeded: without them a switch could be created
        // needing zero votes (bricked on expiry, nobody can release it) or more
        // votes than it has guardians (a threshold that can never be reached).
        require(_votesNeeded > 0, "Set votesNeeded greater than 0!");
        require(_votesNeeded <= countGuardians, "votesNeeded cannot be greater than guardian count!");
        votesNeeded = _votesNeeded;
        emit VotesNeededSet(_votesNeeded);
    }

    // ---------- Owner: check-in ----------

    function checkIn() public onlyOwner notExpired {
        lastCheckIn = block.timestamp;
        emit CheckedIn(block.timestamp);
    }

    // ---------- Owner: manage guardians ----------

    function addGuardian(address guardian) public onlyOwner notExpired {
        require(isGuardian[guardian] == false, "Already a guardian!");
        require(owner != guardian, "Guardian cannot be owner!");

        // Record the position of the guardian in the list
        guardianIndex[guardian] = guardianList.length;

        // Add the guardian to the list
        guardianList.push(guardian);

        // Fill in the card of the guardian
        guardians[guardian] = Guardian(false, block.timestamp);

        // Mark them as a guardian, tag your it!
        isGuardian[guardian] = true;
        emit GuardianAdded(guardian);
    }

    function removeGuardian(address guardian) public onlyOwner notExpired {
        require(isGuardian[guardian], "Not a guardian!");
        require(
            getGuardianCount() - 1 >= votesNeeded, "Can't remove guardian: cant have more votes than guardians silly!"
        );

        // Positions in the list
        uint256 removedIndex = guardianIndex[guardian];
        uint256 lastIndex = getGuardianCount() - 1;

        // The guardian at the end of the list, who will fill the gap
        address movedGuardian = guardianList[lastIndex];

        // Swap: the removed guardian goes to the end, the last one fills the gap
        guardianList[lastIndex] = guardian;
        guardianList[removedIndex] = movedGuardian;

        // Delete the last slot, which now holds the removed guardian
        guardianList.pop();

        // The moved guardian has a new position, so record it
        guardianIndex[movedGuardian] = removedIndex;

        // Clean up the removed guardian's records
        isGuardian[guardian] = false;
        delete guardians[guardian];
        delete guardianIndex[guardian];

        emit GuardianRemoved(guardian);
    }

    function getGuardianCount() public view returns (uint256) {
        return guardianList.length;
    }

    // ---------- Timer ----------

    // Heartbeat works on a scale of minutes to days, so a validator nudging
    // block.timestamp by a few seconds doesn't matter. That's why the
    // block-timestamp lint is disabled below.

    // Past the interval: the grace period has started
    function isOverdue() public view returns (bool) {
        // forge-lint: disable-next-line(block-timestamp)
        return block.timestamp > lastCheckIn + interval;
    }

    // Past the interval AND the grace period: the owner is locked out
    function isExpired() public view returns (bool) {
        // forge-lint: disable-next-line(block-timestamp)
        return block.timestamp > lastCheckIn + interval + gracePeriod;
    }

    // ---------- Voting ----------

    function setVotesNeeded(uint256 _votesNeeded) public onlyOwner notExpired {
        require(_votesNeeded > 0, "Set votesNeeded greater than 0!");
        require(_votesNeeded <= getGuardianCount(), "votesNeeded cannot be greater than guardian count!");
        votesNeeded = _votesNeeded;
        emit VotesNeededSet(votesNeeded);
    }

    function confirmRelease() public onlyGuardian onlyExpired {
        require(votesNeeded > 0, "votesNeeded not set!");
        require(released == false, "Already released!");
        require(guardians[msg.sender].hasVoted == false, "Guardian has already voted!");

        guardians[msg.sender].hasVoted = true;
        voteCount += 1;
        emit VoteCast(msg.sender, voteCount);
        if (voteCount == votesNeeded) {
            released = true;
            emit Released(block.timestamp);
        }
    }
}
