// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Heartbeat {
    address public owner;

    // Stores when the last checked in
    uint256 public lastCheckIn;

    struct Guardian {
        bool hasVoted;
        uint256 whenAdded;
    }

    address[] public guardianList;
    mapping(address => Guardian) public guardians;
    mapping(address => bool) public isGuardian;
    mapping(address => uint256) public guardianIndex;

    uint256 public immutable interval;
    uint256 public immutable gracePeriod;

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not owner!");
        _;
    }

    modifier notExpired() {
        require(isExpired() == false, "Switch has expired!");
        _;
    }

    modifier onlyGuardian() {
        require(isGuardian[msg.sender], "Not a guardian!");
        _;
    }

    modifier onlyExpired() {
        require(isExpired(), "Switch is not expired!");
        _;
    }

    uint256 public votesNeeded;
    uint256 public voteCount;
    bool public released;

    constructor(uint256 _interval, uint256 _gracePeriod) {
        // msg.sender is the person who is currently deploying
        // the contract, set that equal to owner
        owner = msg.sender;

        // Number of seconds since January 1, 1970 UTC.
        // Dont trust over the course of seconds since
        // blocks update around 12s intervals, trust
        // over the course of minutes.
        // https://rareskills.io/learn-solidity/blockTimestamp-and-blockNumber
        lastCheckIn = block.timestamp;

        interval = _interval;
        gracePeriod = _gracePeriod;
    }

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
    }

    function checkIn() public onlyOwner notExpired {
        lastCheckIn = block.timestamp;
    }

    function getGuardianCount() public view returns (uint256) {
        return guardianList.length;
    }

    function removeGuardian(address guardian) public onlyOwner notExpired {
        require(isGuardian[guardian], "Not a guardian!");
        require(
            getGuardianCount() - 1 < votesNeeded,
            "Can't remove guardian: cant have more votes than guardians silly!"
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
    }
    // The reason for this forge-int is because this contract and Heartbeat does
    // not depend on a seconds, missing a couple seconds when the validator updates
    // is okay!
    function isExpired() public view returns (bool) {
        // forge-lint: disable-next-line(block-timestamp)
        return block.timestamp > lastCheckIn + interval + gracePeriod;
    }

    function isOverdue() public view returns (bool) {
        // forge-lint: disable-next-line(block-timestamp)
        return block.timestamp > lastCheckIn + interval;
    }

    function setVotesNeeded(uint256 _votesNeeded) public onlyOwner onlyExpired {
        require(_votesNeeded > 0, "Set votesNeeded greater than 0!");
        require(
            _votesNeeded > getGuardianCount(),
            "votesNeeded cannot be greater than guardian count!"
        );
        votesNeeded = _votesNeeded;
    }

    function confirmRelease() public onlyGuardian onlyExpired {
        require(votesNeeded > 0, "votesNeeded not set!");
        require(released, "Not yet released!");
        require(
            guardians[msg.sender].hasVoted == false,
            "Guardian has already voted!"
        );

        guardians[msg.sender].hasVoted = true;
        voteCount += 1;
        if (voteCount == votesNeeded) {
            released = true;
        }
    }
}
