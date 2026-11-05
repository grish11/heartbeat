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

    function addGuardian(address guardian) public {
        require(msg.sender == owner, "Caller is not owner!");
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

    function checkIn() public {
        require(msg.sender == owner, "Caller is not owner!");
        lastCheckIn = block.timestamp;
    }

    function getGuardianCount() public view returns (uint256) {
        return guardianList.length;
    }

    function removeGuardian(address guardian) public {
        require(msg.sender == owner, "Caller is not the owner!");
        require(isGuardian[guardian], "Not a guardian!");

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

    function isExpired() public view returns (bool) {
        return block.timestamp > lastCheckIn + interval + gracePeriod;
    }

    function isOverdue() public view returns (bool) {
        return block.timestamp > lastCheckIn + interval;
    }
}
