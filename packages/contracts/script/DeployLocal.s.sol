// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {NdiddToken} from "../src/token/NdiddToken.sol";
import {NdiddNFT} from "../src/nft/NdiddNFT.sol";
import {NdiddVault} from "../src/vault/NdiddVault.sol";
import {NdiddGovernor} from "../src/governance/NdiddGovernor.sol";
import {NdiddTimelock} from "../src/governance/NdiddTimelock.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockControllerUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";

/// @title DeployLocal
/// @notice Local development deployment that seeds test accounts with tokens and mints sample NFTs.
contract DeployLocal is Script {
    // Well-known Anvil dev accounts
    address public constant DEV0 = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address public constant DEV1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address public constant DEV2 = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

    function run() external {
        vm.startBroadcast(DEV0);

        // ── 1. Deploy NdiddToken ──────────────────────────────────────────────
        NdiddToken tokenImpl = new NdiddToken();
        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            address(tokenImpl),
            abi.encodeCall(NdiddToken.initialize, (DEV0))
        );
        NdiddToken token = NdiddToken(address(tokenProxy));
        console.log("NdiddToken:", address(token));

        // Seed dev accounts
        token.mint(DEV0, 1_000_000e18);
        token.mint(DEV1, 1_000_000e18);
        token.mint(DEV2, 1_000_000e18);

        // ── 2. Deploy NdiddNFT ────────────────────────────────────────────────
        NdiddNFT nftImpl = new NdiddNFT();
        ERC1967Proxy nftProxy = new ERC1967Proxy(
            address(nftImpl),
            abi.encodeCall(NdiddNFT.initialize, (DEV0))
        );
        NdiddNFT nft = NdiddNFT(address(nftProxy));
        console.log("NdiddNFT:", address(nft));

        // Mint sample NFTs
        nft.safeMint(DEV0, "ipfs://QmSample1");
        nft.safeMint(DEV1, "ipfs://QmSample2");
        nft.safeMint(DEV2, "ipfs://QmSample3");

        // ── 3. Deploy NdiddVault ──────────────────────────────────────────────
        NdiddVault vaultImpl = new NdiddVault();
        ERC1967Proxy vaultProxy = new ERC1967Proxy(
            address(vaultImpl),
            abi.encodeCall(
                NdiddVault.initialize,
                (IERC20(address(token)), address(0), DEV0)
            )
        );
        NdiddVault vault = NdiddVault(address(vaultProxy));
        console.log("NdiddVault:", address(vault));

        // Approve and deposit into vault for DEV0
        token.approve(address(vault), 100_000e18);
        vault.deposit(100_000e18, DEV0);

        // ── 4. Deploy NdiddTimelock ───────────────────────────────────────────
        NdiddTimelock timelockImpl = new NdiddTimelock();
        address[] memory proposers = new address[](1);
        proposers[0] = DEV0;
        address[] memory executors = new address[](1);
        executors[0] = address(0); // open execution
        ERC1967Proxy timelockProxy = new ERC1967Proxy(
            address(timelockImpl),
            abi.encodeCall(NdiddTimelock.initialize, (DEV0, proposers, executors))
        );
        NdiddTimelock timelock = NdiddTimelock(payable(address(timelockProxy)));
        console.log("NdiddTimelock:", address(timelock));

        // Self-delegate token votes for DEV accounts
        token.delegate(DEV0);

        // ── 5. Deploy NdiddGovernor ───────────────────────────────────────────
        NdiddGovernor governorImpl = new NdiddGovernor();
        ERC1967Proxy governorProxy = new ERC1967Proxy(
            address(governorImpl),
            abi.encodeCall(
                NdiddGovernor.initialize,
                (
                    IVotes(address(token)),
                    TimelockControllerUpgradeable(payable(address(timelock))),
                    DEV0
                )
            )
        );
        NdiddGovernor governor = NdiddGovernor(payable(address(governorProxy)));
        console.log("NdiddGovernor:", address(governor));

        // Grant governor proposer role on timelock
        timelock.grantRole(keccak256("PROPOSER_ROLE"), address(governor));
        timelock.grantRole(keccak256("EXECUTOR_ROLE"), address(governor));

        vm.stopBroadcast();

        console.log("\n=== Local Deployment Complete ===");
        console.log("Token    :", address(token));
        console.log("NFT      :", address(nft));
        console.log("Vault    :", address(vault));
        console.log("Timelock :", address(timelock));
        console.log("Governor :", address(governor));
    }
}
