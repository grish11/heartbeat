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
        heartbeat = new Heartbeat(60 seconds, 30 seconds);
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
        skip(50);
        heartbeat.checkIn();
        assertEq(heartbeat.lastCheckIn(), block.timestamp);
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
        assertEq(heartbeat.getGuardianCount(), 2);

        // Check that Asta is no longer a guardian
        assertEq(heartbeat.isGuardian(asta), false);

        // Make sure the values of Asta are back to the defaults ->
        // this is because there are no Nil/None values in Sol
        (bool hasVoted, uint256 whenAdded) = heartbeat.guardians(asta);
        assertEq(hasVoted, false);
        assertEq(whenAdded, 0);

        // Make sure bob's position has been updated
        assertEq(heartbeat.guardianList(1), bob);
        assertEq(heartbeat.guardianIndex(bob), 1);
    }

    // Remove a guardian from the end
    function testRemoveGuardianFromEnd() public {
        // Add entries to the guardian list for testing
        address ginko = makeAddr("ginko");
        address asta = makeAddr("asta");
        address bob = makeAddr("bob");
        heartbeat.addGuardian(ginko);
        heartbeat.addGuardian(asta);
        heartbeat.addGuardian(bob);

        heartbeat.removeGuardian(bob);

        // Check that the length decreased by 1
        assertEq(heartbeat.getGuardianCount(), 2);

        // Check that Bob is no longer a guardian
        assertEq(heartbeat.isGuardian(bob), false);

        // Make sure the values of Bob are back to the defaults ->
        // this is because there are no Nil/None values in Sol
        (bool hasVoted, uint256 whenAdded) = heartbeat.guardians(bob);
        assertEq(hasVoted, false);
        assertEq(whenAdded, 0);
    }

    // Remove a non-guardian
    function testRemoveNonGuardian() public {
        address light = makeAddr("light");
        address l = makeAddr("l");
        heartbeat.addGuardian(light);

        // Expect the next result after expectRevert to not eval correctly
        vm.expectRevert();
        heartbeat.removeGuardian(l);
    }

    // Remove a guardian as a stranger (not owner!)
    function testStrangerRemoveGuardian() public {
        // Add entries to the guardian list for testing
        address ginko = makeAddr("ginko");
        address asta = makeAddr("asta");
        heartbeat.addGuardian(ginko);
        heartbeat.addGuardian(asta);

        address strangerAddress = makeAddr("stranger");
        vm.expectRevert();
        vm.prank(strangerAddress);
        heartbeat.removeGuardian(asta);
    }

    // Right after deploying, no time has passed, so the switch is not expired
    function testNotExpiredRightAfterDeploy() public view {
        assertEq(heartbeat.isExpired(), false);
    }

    // With no check-in, the switch expires once the interval and grace period pass
    function testExpiredAfterIntervalAndGrace() public {
        // Move time forward 1000 seconds, well past interval (60s) + grace (30s).
        skip(1000);
        assertEq(heartbeat.isExpired(), true);
    }

    // After the initial interval time period, test whether the grace period is active
    function testOverdueAfterIntervalTimePeriod() public {
        skip(70);
        assertEq(heartbeat.isOverdue(), true);
    }

    // After expiry, the owner can't check in or change guardians
    function testOwnerLockedOutAfterExpiry() public {
        address bob = makeAddr("bob");
        heartbeat.addGuardian(bob);

        // Past interval (60s) + grace (30s)
        skip(91);

        vm.expectRevert();
        heartbeat.checkIn();

        vm.expectRevert();
        heartbeat.addGuardian(makeAddr("asta"));

        vm.expectRevert();
        heartbeat.removeGuardian(bob);
    }
}
