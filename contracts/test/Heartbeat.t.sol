// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// Foundry's testing toolkit: gives us assertEq, vm cheatcodes, makeAddr, etc.
import {Test} from "forge-std/Test.sol";
// The contract we're testing
import {Heartbeat} from "../src/Heartbeat.sol";

// "is Test" means this contract inherits all of Foundry's testing tools
contract HeartbeatTest is Test {
    // Holds the Heartbeat contract we deploy for each test
    Heartbeat heartbeat;

    // Runs before EVERY test, so each test starts with a fresh contract.
    // Because this test contract deploys Heartbeat, this test contract
    // becomes the owner (msg.sender in Heartbeat's constructor).
    function setUp() public {
        heartbeat = new Heartbeat();
    }

    // The deployer (this test contract) should be the owner
    function testOwnerIsDeployer() public view {
        assertEq(heartbeat.owner(), address(this));
    }

    // Deploying counts as the first check-in, so lastCheckIn
    // should equal the time the contract was deployed
    function testLastCheckInSetOnDeploy() public view {
        assertEq(heartbeat.lastCheckIn(), block.timestamp);
    }

    // The owner checks in later, and lastCheckIn updates to the new time
    function testOwnerCanCheckIn() public {
        // vm.warp SETS the clock to an exact time (it doesn't add).
        // Time is seconds since Jan 1, 1970, so this means "it's now second 1000."
        vm.warp(1000);
        heartbeat.checkIn();
        // lastCheckIn should now be the time we warped to
        assertEq(heartbeat.lastCheckIn(), 1000);
    }

    // Someone who isn't the owner must not be able to check in
    function testStrangerCannotCheckIn() public {
        // Create a fake wallet address labeled "stranger" in test output
        address strangerAddress = makeAddr("stranger");

        // Note for Foundry: the next contract call should fail (revert).
        // If it succeeds, this test fails.
        vm.expectRevert();

        // Note for Foundry: the next contract call comes FROM the stranger,
        // so inside Heartbeat, msg.sender will be strangerAddress
        vm.prank(strangerAddress);

        // The stranger calls checkIn on the Heartbeat contract.
        // The owner check in checkIn() rejects them, which is what we expect.
        heartbeat.checkIn();
    }

    // The owner can add a guardian, and it's stored correctly
    function testOwnerCanAddGuardian() public {
        // Create a possible guardian --> Bob :3
        address bobAddr = makeAddr("bob");

        heartbeat.addGuardian(bobAddr);

        // Bob is now marked as a guardian, and he's the only one
        assertTrue(heartbeat.isGuardian(bobAddr));
        assertEq(heartbeat.getGuardianCount(), 1);
    }

    // The same guardian can't be added twice
    function testCannotAddSameGuardianTwice() public {
        address bobAddr = makeAddr("bob");
        heartbeat.addGuardian(bobAddr);

        // Adding Bob again should fail, since he already exists
        vm.expectRevert();
        heartbeat.addGuardian(bobAddr);
    }

    // Someone who isn't the owner can't add guardians
    function testStrangerCannotAddGuardian() public {
        address strangerAddr = makeAddr("stranger");
        address strangerFriendAddr = makeAddr("strangersFriend");

        // The stranger tries to add their friend, which should fail
        vm.expectRevert();
        vm.prank(strangerAddr);
        heartbeat.addGuardian(strangerFriendAddr);
    }

    // The owner can't be their own guardian
    function testOwnerCannotBeGuardian() public {
        // address(this) is the owner, since this test contract deployed Heartbeat
        vm.expectRevert();
        heartbeat.addGuardian(address(this));
    }

    // Remove a guardian from the middle
    function testRemoveGuardianFromMiddle() public {
        // Add entries to the guardian list for testing
        address ginko = makeAddr("ginko");
        address asta = makeAddr("asta");
        address bob = makeAddr("bob");
        heartbeat.addGuardian(ginko);
        heartbeat.addGuardian(asta);
        heartbeat.addGuardian(bob);

        // Remove asta form the guardianList
        heartbeat.removeGuardian(asta);

        // Check that the length decreased by 1
        assertEq(getGuardianCount(), 2);

        // Check that Asta is no longer a guardian
        assertEq(heartbeat.isGuardian(asta));

        // Make sure the values of Asta are back to the defaults ->
        // this is because there are no Nil/None values in Sol
        (bool hasVoted, uint256 whenAdded) = heartbeat.guardians(asta);
        assertEq(hasVoted);
        assertEq(whenAdded, 0);

        // Make sure bob's position has been updated
        assertEq(heartbeat.guardianList[1], bob);
        assertEq(heartbeat.guardianIndex(bob), 1);
    }
    // Try removing from the end
    // Try removing a non-guardian
    // Try a stranger trying to remove a guardian
}
