// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {StdPrecompiles} from "tempo-std/StdPrecompiles.sol";
import {StdTokens} from "tempo-std/StdTokens.sol";
import {Grabpo} from "../src/Grabpo.sol";

contract GrabpoScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerKey = vm.envUint("GRABPO_DEPLOYER_KEY");
        address judge = vm.envAddress("GRABPO_JUDGE");

        vm.startBroadcast(deployerKey);

        address feeToken = vm.envOr("TEMPO_FEE_TOKEN", StdTokens.PATH_USD_ADDRESS);
        StdPrecompiles.TIP_FEE_MANAGER.setUserToken(feeToken);

        Grabpo grabpo = new Grabpo(judge);

        vm.stopBroadcast();

        console2.log("Grabpo deployed at:", address(grabpo));
        console2.log("Judge:", judge);
    }
}
