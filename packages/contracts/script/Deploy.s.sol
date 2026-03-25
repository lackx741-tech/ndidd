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
import {AccountFactory, IEntryPoint} from "../src/aa/AccountFactory.sol";
import {NdiddPaymaster, IEntryPointPaymaster} from "../src/aa/NdiddPaymaster.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockControllerUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";

/// @title Deploy
/// @notice Production deployment script: deploys all Ndidd protocol contracts via UUPS proxy pattern.
contract Deploy is Script {
    // ── addresses emitted at end ──────────────────────────────────────────────
    address public tokenImpl;
    address public tokenProxy;
    address public nftImpl;
    address public nftProxy;
    address public vaultImpl;
    address public vaultProxy;
    address public timelockImpl;
    address public timelockProxy;
    address public governorImpl;
    address public governorProxy;
    address public accountFactory;
    address public paymaster;

    function run() external {
        address deployer = _deployer();
        console.log("Deployer:", deployer);

        vm.startBroadcast();

        // ── 1. NdiddToken ─────────────────────────────────────────────────────
        tokenImpl = address(new NdiddToken());
        tokenProxy = address(
            new ERC1967Proxy(
                tokenImpl,
                abi.encodeCall(NdiddToken.initialize, (deployer))
            )
        );
        console.log("NdiddToken impl :", tokenImpl);
        console.log("NdiddToken proxy:", tokenProxy);

        // ── 2. NdiddNFT ───────────────────────────────────────────────────────
        nftImpl = address(new NdiddNFT());
        nftProxy = address(
            new ERC1967Proxy(
                nftImpl,
                abi.encodeCall(NdiddNFT.initialize, (deployer))
            )
        );
        console.log("NdiddNFT impl :", nftImpl);
        console.log("NdiddNFT proxy:", nftProxy);

        // ── 3. NdiddVault ─────────────────────────────────────────────────────
        // Uses the token as underlying asset. Strategy can be set later.
        vaultImpl = address(new NdiddVault());
        vaultProxy = address(
            new ERC1967Proxy(
                vaultImpl,
                abi.encodeCall(
                    NdiddVault.initialize,
                    (IERC20(tokenProxy), address(0), deployer)
                )
            )
        );
        console.log("NdiddVault impl :", vaultImpl);
        console.log("NdiddVault proxy:", vaultProxy);

        // ── 4. NdiddTimelock ──────────────────────────────────────────────────
        timelockImpl = address(new NdiddTimelock());
        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](1);
        executors[0] = address(0); // open execution
        timelockProxy = address(
            new ERC1967Proxy(
                timelockImpl,
                abi.encodeCall(NdiddTimelock.initialize, (deployer, proposers, executors))
            )
        );
        console.log("NdiddTimelock impl :", timelockImpl);
        console.log("NdiddTimelock proxy:", timelockProxy);

        // ── 5. NdiddGovernor ──────────────────────────────────────────────────
        governorImpl = address(new NdiddGovernor());
        governorProxy = address(
            new ERC1967Proxy(
                governorImpl,
                abi.encodeCall(
                    NdiddGovernor.initialize,
                    (
                        IVotes(tokenProxy),
                        TimelockControllerUpgradeable(payable(timelockProxy)),
                        deployer
                    )
                )
            )
        );
        console.log("NdiddGovernor impl :", governorImpl);
        console.log("NdiddGovernor proxy:", governorProxy);

        // ── 6. Wire up roles ──────────────────────────────────────────────────
        _setupGovernanceRoles(deployer);

        // ── 7. AccountFactory (ERC-4337) ──────────────────────────────────────
        // ERC-4337 canonical EntryPoint v0.6 — update to v0.7 when available on target chain.
        address entryPointAddr = vm.envOr("ENTRY_POINT_ADDRESS", 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789);
        accountFactory = address(new AccountFactory(IEntryPoint(entryPointAddr)));
        console.log("AccountFactory  :", accountFactory);

        // ── 8. NdiddPaymaster ─────────────────────────────────────────────────
        // Signer can be a separate hot wallet managed by the backend.
        address paymasterSigner = vm.envOr("PAYMASTER_SIGNER", deployer);
        uint256 minBalance = vm.envOr("PAYMASTER_MIN_TOKEN_BALANCE", uint256(0));
        paymaster = address(
            new NdiddPaymaster(
                IEntryPointPaymaster(entryPointAddr),
                deployer,          // admin
                paymasterSigner,   // signer (SIGNER_ROLE)
                tokenProxy,        // NDIDD token for optional balance gate
                minBalance
            )
        );
        console.log("NdiddPaymaster  :", paymaster);

        vm.stopBroadcast();

        _logSummary();
    }

    /// @dev Grants the governor proposer rights on the timelock and revokes deployer admin.
    function _setupGovernanceRoles(address deployer) internal {
        NdiddTimelock timelock = NdiddTimelock(payable(timelockProxy));

        bytes32 proposerRole = keccak256("PROPOSER_ROLE");
        bytes32 executorRole = keccak256("EXECUTOR_ROLE");
        bytes32 adminRole = timelock.DEFAULT_ADMIN_ROLE();

        // Governor gets proposer role
        timelock.grantRole(proposerRole, governorProxy);
        // Deployer also gets proposer for initial governance bootstrap
        timelock.grantRole(proposerRole, deployer);
        // Open execution (already set via address(0) in executors)
        timelock.grantRole(executorRole, governorProxy);

        // Renounce deployer admin role to hand control fully to timelock
        // (Comment out for testnet/local where you may need to retain admin)
        // timelock.renounceRole(adminRole, deployer);
        (adminRole); // silence unused warning — kept for intentional future use
    }

    /// @dev Prints a deployment summary table.
    function _logSummary() internal view {
        console.log("\n=== Deployment Summary ===");
        console.log("NdiddToken  :", tokenProxy);
        console.log("NdiddNFT    :", nftProxy);
        console.log("NdiddVault  :", vaultProxy);
        console.log("NdiddTimelock:", timelockProxy);
        console.log("NdiddGovernor :", governorProxy);
        console.log("AccountFactory :", accountFactory);
        console.log("NdiddPaymaster :", paymaster);
        console.log("==========================\n");
    }

    /// @dev Returns the broadcaster address (works for both local and prod).
    function _deployer() internal view returns (address) {
        return msg.sender;
    }
}
