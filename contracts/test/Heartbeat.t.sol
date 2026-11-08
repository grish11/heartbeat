// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {Heartbeat} from "../src/Heartbeat.sol";

contract HeartbeatTest is Test {
    Heartbeat heartbeat;

    // Some tests use these 3 test addreses, initialize them here
    address ginko;
    address asta;
    address bob;

    // Fresh contract before every test: 60s interval, 30s grace period.
    // This test contract deploys it, so it's the owner.
    function setUp() public {
        heartbeat = new Heartbeat(60 seconds, 30 seconds);
    }

    // Some test functions use these, this is a helper function
    function setupThreeGuardians() internal {
        ginko = makeAddr("ginko");
        asta = makeAddr("asta");
        bob = makeAddr("bob");
        heartbeat.addGuardian(ginko);
        heartbeat.addGuardian(asta);
        heartbeat.addGuardian(bob);
    }

    // ---------- Owner & check-in ----------

    // The deployer is the owner
    function testOwnerIsDeployer() public view {
        assertEq(heartbeat.owner(), address(this));
    }

    // Deploying counts as the first check-in
    function testLastCheckInSetOnDeploy() public view {
        assertEq(heartbeat.lastCheckIn(), block.timestamp);
    }

    // Checking in updates lastCheckIn to now
    function testOwnerCanCheckIn() public {
        skip(50);
        heartbeat.checkIn();
        assertEq(heartbeat.lastCheckIn(), block.timestamp);
    }

    // Only the owner can check in
    function testStrangerCannotCheckIn() public {
        address strangerAddress = makeAddr("stranger");

        vm.expectRevert(); // next call should fail
        vm.prank(strangerAddress); // next call comes from the stranger
        heartbeat.checkIn();
    }

    // ---------- Adding guardians ----------

    // The owner can add a guardian
    function testOwnerCanAddGuardian() public {
        address bobAddr = makeAddr("bob"); // Bob :3

        heartbeat.addGuardian(bobAddr);

        assertTrue(heartbeat.isGuardian(bobAddr));
        assertEq(heartbeat.getGuardianCount(), 1);
    }

    // No duplicate guardians
    function testCannotAddSameGuardianTwice() public {
        address bobAddr = makeAddr("bob");
        heartbeat.addGuardian(bobAddr);

        vm.expectRevert();
        heartbeat.addGuardian(bobAddr);
    }

    // Only the owner can add guardians
    function testStrangerCannotAddGuardian() public {
        address strangerAddr = makeAddr("stranger");
        address strangerFriendAddr = makeAddr("strangersFriend");

        vm.expectRevert();
        vm.prank(strangerAddr);
        heartbeat.addGuardian(strangerFriendAddr);
    }

    // The owner can't be their own guardian
    function testOwnerCannotBeGuardian() public {
        vm.expectRevert();
        heartbeat.addGuardian(address(this));
    }

    // ---------- Removing guardians ----------

    // Removing from the middle moves the last guardian into the gap
    function testRemoveGuardianFromMiddle() public {
        setupThreeGuardians();

        heartbeat.removeGuardian(asta);

        assertEq(heartbeat.getGuardianCount(), 2);
        assertEq(heartbeat.isGuardian(asta), false);

        // Asta's card is back to defaults (Solidity has no None)
        (bool hasVoted, uint256 whenAdded) = heartbeat.guardians(asta);
        assertEq(hasVoted, false);
        assertEq(whenAdded, 0);

        // Bob moved into Asta's old spot
        assertEq(heartbeat.guardianList(1), bob);
        assertEq(heartbeat.guardianIndex(bob), 1);
    }

    // Removing the last guardian just pops them off
    function testRemoveGuardianFromEnd() public {
        setupThreeGuardians();

        heartbeat.removeGuardian(bob);

        assertEq(heartbeat.getGuardianCount(), 2);
        assertEq(heartbeat.isGuardian(bob), false);

        // Bob's card is back to defaults
        (bool hasVoted, uint256 whenAdded) = heartbeat.guardians(bob);
        assertEq(hasVoted, false);
        assertEq(whenAdded, 0);
    }

    // Can't remove someone who isn't a guardian
    function testRemoveNonGuardian() public {
        address light = makeAddr("light");
        address l = makeAddr("l");
        heartbeat.addGuardian(light);

        vm.expectRevert();
        heartbeat.removeGuardian(l);
    }

    // Only the owner can remove guardians
    function testStrangerRemoveGuardian() public {
        address ginko = makeAddr("ginko");
        address asta = makeAddr("asta");
        heartbeat.addGuardian(ginko);
        heartbeat.addGuardian(asta);

        address strangerAddress = makeAddr("stranger");
        vm.expectRevert();
        vm.prank(strangerAddress);
        heartbeat.removeGuardian(asta);
    }

    // ---------- Timer ----------

    // Not expired right after deploy
    function testNotExpiredRightAfterDeploy() public view {
        assertEq(heartbeat.isExpired(), false);
    }

    // Expired once interval + grace pass with no check-in
    function testExpiredAfterIntervalAndGrace() public {
        skip(1000); // well past 60s + 30s
        assertEq(heartbeat.isExpired(), true);
    }

    // Overdue once the interval passes (grace period has started)
    function testOverdueAfterIntervalTimePeriod() public {
        skip(70);
        assertEq(heartbeat.isOverdue(), true);
    }

    // After expiry, the owner can't check in or change guardians
    function testOwnerLockedOutAfterExpiry() public {
        address bob = makeAddr("bob");
        heartbeat.addGuardian(bob);

        skip(91); // past 60s + 30s

        vm.expectRevert();
        heartbeat.checkIn();

        vm.expectRevert();
        heartbeat.addGuardian(makeAddr("asta"));

        vm.expectRevert();
        heartbeat.removeGuardian(bob);
    }

    // ---------- Voting ----------

    // 2 of 3 guardians vote after expiry, so the switch is released
    function testPossibleRelease() public {
        setupThreeGuardians();

        heartbeat.setVotesNeeded(2); // must be set before expiry
        skip(91);

        vm.prank(ginko);
        heartbeat.confirmRelease();

        vm.prank(asta);
        heartbeat.confirmRelease();

        assertEq(heartbeat.released(), true);
    }
}
