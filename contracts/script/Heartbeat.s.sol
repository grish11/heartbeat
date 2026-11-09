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

        Heartbeat heartbeat = new Heartbeat(5 minutes, 2 minutes, fingerprint, ipfsLink);

        console.log("Heartbeat deployed at:", address(heartbeat));

        vm.stopBroadcast();
    }
}
