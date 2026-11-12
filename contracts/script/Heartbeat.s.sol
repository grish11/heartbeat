// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {Heartbeat} from "../src/Heartbeat.sol";
import {console} from "forge-std/console.sol";

contract DeployScript is Script {
    function run() public {
        // Everything after this a real transaction
        vm.startBroadcast();

        bytes32 fingerprint = keccak256("test file");
        string memory ipfsLink = "faketestlink";

        // A switch cannot be created without guardians, so the local deploy
        // seeds two of anvil's default accounts and a threshold of 1.
        address[] memory guardians = new address[](2);
        guardians[0] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        guardians[1] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

        Heartbeat heartbeat = new Heartbeat(5 minutes, 2 minutes, fingerprint, ipfsLink, 1, guardians);

        console.log("Heartbeat deployed at:", address(heartbeat));

        vm.stopBroadcast();
    }
}
