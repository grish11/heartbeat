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

    bytes32 fingerprint;
    string ipfsLink;

    // Fresh contract before every test: 60s interval, 30s grace period,
    // three guardians and a threshold of 1.
    // This test contract deploys it, so it's the owner.
    //
    // The guardians come from the constructor because a switch can no longer
    // be created without them: votesNeeded must be at least 1 and at most the
    // guardian count, so zero guardians is unconstructable.
    function setUp() public {
        fingerprint = keccak256("test file");
        ipfsLink = "faketestlink";

        ginko = makeAddr("ginko");
        asta = makeAddr("asta");
        bob = makeAddr("bob");

        heartbeat = new Heartbeat(
            60 seconds,
            30 seconds,
            fingerprint,
            ipfsLink,
            1,
            threeGuardians()
        );
    }

    // The standard guardian set, in list order.
    function threeGuardians() internal view returns (address[] memory) {
        address[] memory gs = new address[](3);
        gs[0] = ginko;
        gs[1] = asta;
        gs[2] = bob;
        return gs;
    }

    // A one-element guardian list, for tests that only need a valid switch.
    function oneGuardian(address g) internal pure returns (address[] memory) {
        address[] memory gs = new address[](1);
        gs[0] = g;
        return gs;
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
        // setUp already seeded three, so this is the fourth.
        assertEq(heartbeat.getGuardianCount(), 4);
    }

    // No duplicate guardians
    function testCannotAddSameGuardianTwice() public {
        vm.expectRevert();
        heartbeat.addGuardian(bob);
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
        skip(91); // past 60s + 30s

        vm.expectRevert();
        heartbeat.checkIn();

        vm.expectRevert(bytes("Switch has expired!"));
        heartbeat.addGuardian(asta);

        vm.expectRevert();
        heartbeat.removeGuardian(bob);
    }

    // ---------- Voting ----------

    // 2 of 3 guardians vote after expiry, so the switch is released
    function testPossibleRelease() public {
        heartbeat.setVotesNeeded(2); // must be set before expiry
        skip(91);

        vm.prank(ginko);
        heartbeat.confirmRelease();

        vm.prank(asta);
        heartbeat.confirmRelease();

        assertEq(heartbeat.released(), true);
    }

    // Amount of votes can't be zero
    function testVotesSetToZero() public {
        vm.expectRevert();
        heartbeat.setVotesNeeded(0);
    }

    // Set the amount of votes greater than the amount of guardians
    function testVotesMoreThanGuardians() public {
        vm.expectRevert();
        // 3 guardians so we cant have 4 votes!
        heartbeat.setVotesNeeded(4);
    }

    // A stranger should not be able to set the amount of votes
    function testStrangerSetVotes() public {
        address strangerAddress = makeAddr("stranger");

        vm.expectRevert();
        vm.prank(strangerAddress);
        // Amount of votes passed in is good, but a stranger cannot do this!
        heartbeat.setVotesNeeded(2);
    }

    // Removing too many guardians would leave to few
    function testRemovingTooMany() public {
        heartbeat.setVotesNeeded(2);

        heartbeat.removeGuardian(ginko);

        vm.expectRevert();
        heartbeat.removeGuardian(asta);
    }

    // Voting before the Expiry can't happen
    function testVotingBeforeExpiry() public {
        heartbeat.setVotesNeeded(2);
        skip(61);

        vm.prank(ginko);
        vm.expectRevert();
        heartbeat.confirmRelease();
    }

    // A non-guardian cannot vote (including an owner)
    function testNonGuardianVote() public {
        skip(91);
        vm.expectRevert();
        heartbeat.confirmRelease();
    }

    // The same guardian cannot vote twice
    function testGuardianVoteTwice() public {
        heartbeat.setVotesNeeded(2);
        skip(91);

        vm.prank(asta);
        heartbeat.confirmRelease();

        vm.expectRevert(bytes("Guardian has already voted!"));
        vm.prank(asta);
        heartbeat.confirmRelease();
    }

    // One vote out of two needed doesn't release the switch
    function testOneVoteNotEnough() public {
        heartbeat.setVotesNeeded(2);
        skip(91);

        vm.prank(ginko);
        heartbeat.confirmRelease();

        assertEq(heartbeat.released(), false);
        assertEq(heartbeat.voteCount(), 1);

        // Ginko's card records the vote
        (bool hasVoted, ) = heartbeat.guardians(ginko);
        assertTrue(hasVoted);
    }

    // Checks to see if the fingerprint, link in the constructor match
    // the fingerprint, link the test values passed in
    function testReadFingerprintAndIPFSLink() public view {
        assertEq(heartbeat.fingerprint(), fingerprint);
        assertEq(heartbeat.ipfsLink(), ipfsLink);
    }

    // An empty fingerprint is rejected
    function testEmptyFingerprintReverts() public {
        vm.expectRevert();
        new Heartbeat(
            60 seconds,
            30 seconds,
            bytes32(0),
            ipfsLink,
            1,
            threeGuardians()
        );
    }

    // An empty IPFS link is rejected
    function testEmptyLinkReverts() public {
        vm.expectRevert();
        new Heartbeat(
            60 seconds,
            30 seconds,
            fingerprint,
            "",
            1,
            threeGuardians()
        );
    }

    // ---------- Events ----------

    // Checking in announces the new check-in time
    function testEventCheckIn() public {
        skip(15); // move time so the timestamp isn't the deploy time
        vm.expectEmit();
        emit Heartbeat.CheckedIn(block.timestamp);
        heartbeat.checkIn();
    }

    // Adding a guardian announces who was added
    function testEventGuardianAdded() public {
        // A fresh address: the setUp guardians were added before we started watching
        address bobAddr = makeAddr("bob");
        vm.expectEmit();
        emit Heartbeat.GuardianAdded(bobAddr);
        heartbeat.addGuardian(bobAddr);
    }

    // A vote announces who voted and the new total
    function testEventVoteCast() public {
        heartbeat.setVotesNeeded(2);
        skip(91); // past the deadline, so voting is open

        vm.expectEmit();
        emit Heartbeat.VoteCast(ginko, 1); // Ginko's vote, total is now 1

        vm.prank(ginko);
        heartbeat.confirmRelease();
    }

    // The deciding vote announces the release
    function testEventReleased() public {
        heartbeat.setVotesNeeded(2);
        skip(91);

        // First vote: not enough to release yet
        vm.prank(ginko);
        heartbeat.confirmRelease();

        // Second vote reaches 2 of 2, so Released should fire
        // (VoteCast also fires, and Foundry allows it in between)
        vm.expectEmit();
        emit Heartbeat.Released(block.timestamp);

        vm.prank(asta);
        heartbeat.confirmRelease();
    }

    function testEventGuaridanRemoved() public {
        emit Heartbeat.GuardianRemoved(asta);
        heartbeat.removeGuardian(asta);
    }

    function testEventVotesNeededSet() public {
        emit Heartbeat.VotesNeededSet(2);
        heartbeat.setVotesNeeded(2);
    }

    // ---------- Constructor: guardians and threshold ----------

    // The whole point of moving guardians into the constructor: a guardian
    // created there must be able to vote. This fails if any of the four
    // storage writes is missed, which a count assertion alone would not catch.
    function testConstructorGuardianCanVote() public {
        skip(91); // past interval + grace, so voting is open

        vm.prank(ginko);
        heartbeat.confirmRelease();

        assertEq(heartbeat.released(), true);
    }

    // Guardians land in the list exactly once, in order, with matching indexes.
    function testConstructorStoresEachGuardianOnce() public view {
        assertEq(heartbeat.getGuardianCount(), 3);

        assertEq(heartbeat.guardianList(0), ginko);
        assertEq(heartbeat.guardianList(1), asta);
        assertEq(heartbeat.guardianList(2), bob);

        assertEq(heartbeat.guardianIndex(ginko), 0);
        assertEq(heartbeat.guardianIndex(asta), 1);
        assertEq(heartbeat.guardianIndex(bob), 2);

        (, uint256 whenAdded) = heartbeat.guardians(ginko);
        assertEq(whenAdded, block.timestamp);
    }

    // The same address twice in the list is rejected
    function testConstructorRejectsDuplicateGuardian() public {
        address[] memory gs = new address[](2);
        gs[0] = ginko;
        gs[1] = ginko;

        vm.expectRevert(bytes("Already a guardian!"));
        new Heartbeat(60 seconds, 30 seconds, fingerprint, ipfsLink, 1, gs);
    }

    // The zero address would be a guardian nobody controls
    function testConstructorRejectsZeroAddressGuardian() public {
        address[] memory gs = new address[](2);
        gs[0] = ginko;
        gs[1] = address(0);

        vm.expectRevert(bytes("Guardian cannot be the zero address!"));
        new Heartbeat(60 seconds, 30 seconds, fingerprint, ipfsLink, 1, gs);
    }

    // The owner cannot guard their own switch
    function testConstructorRejectsOwnerAsGuardian() public {
        vm.expectRevert(bytes("Guardian cannot be owner!"));
        new Heartbeat(
            60 seconds,
            30 seconds,
            fingerprint,
            ipfsLink,
            1,
            oneGuardian(address(this))
        );
    }

    // A threshold of zero would brick the switch on expiry: nobody could
    // ever release it, and the owner is locked out.
    function testConstructorRejectsZeroVotesNeeded() public {
        vm.expectRevert(bytes("Set votesNeeded greater than 0!"));
        new Heartbeat(
            60 seconds,
            30 seconds,
            fingerprint,
            ipfsLink,
            0,
            threeGuardians()
        );
    }

    // A threshold above the guardian count could never be reached
    function testConstructorRejectsVotesNeededAboveCount() public {
        vm.expectRevert(
            bytes("votesNeeded cannot be greater than guardian count!")
        );
        new Heartbeat(
            60 seconds,
            30 seconds,
            fingerprint,
            ipfsLink,
            4,
            threeGuardians()
        );
    }

    // No guardians at all is unconstructable: votesNeeded must be at least 1
    // and at most the count, which no value satisfies when the count is zero.
    function testConstructorRejectsNoGuardians() public {
        address[] memory none = new address[](0);

        vm.expectRevert(bytes("Set votesNeeded greater than 0!"));
        new Heartbeat(60 seconds, 30 seconds, fingerprint, ipfsLink, 0, none);

        vm.expectRevert(
            bytes("votesNeeded cannot be greater than guardian count!")
        );
        new Heartbeat(60 seconds, 30 seconds, fingerprint, ipfsLink, 1, none);
    }

    // The bound makes an oversized list fail clearly rather than run out of gas
    function testConstructorRejectsTooManyGuardians() public {
        address[] memory many = new address[](51);
        for (uint256 i = 0; i < 51; ++i) {
            many[i] = address(uint160(i + 2)); // never 0, never the owner
        }

        vm.expectRevert(bytes("Guardian count limited to 50."));
        new Heartbeat(60 seconds, 30 seconds, fingerprint, ipfsLink, 1, many);
    }

    // Exactly at the bound is still allowed
    function testConstructorAcceptsFiftyGuardians() public {
        address[] memory many = new address[](50);
        for (uint256 i = 0; i < 50; ++i) {
            many[i] = address(uint160(i + 2));
        }

        Heartbeat big = new Heartbeat(
            60 seconds,
            30 seconds,
            fingerprint,
            ipfsLink,
            25,
            many
        );
        assertEq(big.getGuardianCount(), 50);
        assertEq(big.votesNeeded(), 25);
    }

    // The Activity timeline is built from logs, so the constructor has to
    // announce what it did.
    function testConstructorEmitsEvents() public {
        vm.expectEmit();
        emit Heartbeat.GuardianAdded(ginko);
        vm.expectEmit();
        emit Heartbeat.VotesNeededSet(1);

        new Heartbeat(
            60 seconds,
            30 seconds,
            fingerprint,
            ipfsLink,
            1,
            oneGuardian(ginko)
        );
    }
}
