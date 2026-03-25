// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {NdiddToken} from "../../src/token/NdiddToken.sol";

contract NdiddTokenTest is Test {
    NdiddToken public token;
    address public admin = makeAddr("admin");
    address public minter = makeAddr("minter");
    address public pauser = makeAddr("pauser");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    function setUp() public {
        NdiddToken impl = new NdiddToken();
        bytes memory initData = abi.encodeCall(NdiddToken.initialize, (admin));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        token = NdiddToken(address(proxy));

        vm.startPrank(admin);
        token.grantRole(MINTER_ROLE, minter);
        token.grantRole(PAUSER_ROLE, pauser);
        vm.stopPrank();
    }

    function test_initialize() public view {
        assertEq(token.name(), "Ndidd Token");
        assertEq(token.symbol(), "NDIDD");
        assertEq(token.totalSupply(), 0);
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(token.hasRole(MINTER_ROLE, admin));
        assertTrue(token.hasRole(PAUSER_ROLE, admin));
        assertTrue(token.hasRole(UPGRADER_ROLE, admin));
    }

    function test_mint() public {
        vm.prank(minter);
        token.mint(alice, 1000e18);
        assertEq(token.balanceOf(alice), 1000e18);
        assertEq(token.totalSupply(), 1000e18);
    }

    function test_mint_revertsIfNotMinter() public {
        vm.expectRevert();
        vm.prank(alice);
        token.mint(alice, 1000e18);
    }

    function test_mint_revertsIfExceedsMaxSupply() public {
        uint256 maxSupply = token.MAX_SUPPLY();
        vm.prank(minter);
        token.mint(alice, maxSupply);
        vm.expectRevert("NdiddToken: max supply exceeded");
        vm.prank(minter);
        token.mint(alice, 1);
    }

    function test_burn() public {
        vm.prank(minter);
        token.mint(alice, 500e18);

        vm.prank(alice);
        token.burn(200e18);

        assertEq(token.balanceOf(alice), 300e18);
        assertEq(token.totalSupply(), 300e18);
    }

    function test_burnFrom() public {
        vm.prank(minter);
        token.mint(alice, 500e18);

        vm.prank(alice);
        token.approve(bob, 200e18);

        vm.prank(bob);
        token.burnFrom(alice, 200e18);

        assertEq(token.balanceOf(alice), 300e18);
    }

    function test_pause() public {
        vm.prank(minter);
        token.mint(alice, 1000e18);

        vm.prank(pauser);
        token.pause();
        assertTrue(token.paused());

        vm.expectRevert();
        vm.prank(alice);
        token.transfer(bob, 100e18);
    }

    function test_unpause() public {
        vm.prank(pauser);
        token.pause();

        vm.prank(pauser);
        token.unpause();
        assertFalse(token.paused());

        vm.prank(minter);
        token.mint(alice, 100e18);

        vm.prank(alice);
        token.transfer(bob, 50e18);
        assertEq(token.balanceOf(bob), 50e18);
    }

    function test_pause_revertsIfNotPauser() public {
        vm.expectRevert();
        vm.prank(alice);
        token.pause();
    }

    function test_votingPower() public {
        vm.prank(minter);
        token.mint(alice, 1000e18);

        vm.prank(alice);
        token.delegate(alice);

        assertEq(token.getVotes(alice), 1000e18);
    }

    function test_permit() public {
        uint256 privKey = 0xA11CE;
        address signer = vm.addr(privKey);

        vm.prank(minter);
        token.mint(signer, 1000e18);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    token.DOMAIN_SEPARATOR(),
                    keccak256(
                        abi.encode(
                            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                            signer,
                            bob,
                            500e18,
                            token.nonces(signer),
                            deadline
                        )
                    )
                )
            )
        );

        token.permit(signer, bob, 500e18, deadline, v, r, s);
        assertEq(token.allowance(signer, bob), 500e18);
    }

    function test_transferWhilePausedReverts() public {
        vm.prank(minter);
        token.mint(alice, 1000e18);

        vm.prank(pauser);
        token.pause();

        vm.expectRevert();
        vm.prank(alice);
        token.transfer(bob, 100e18);
    }

    function test_maxSupplyConstant() public view {
        assertEq(token.MAX_SUPPLY(), 1_000_000_000e18);
    }

    function test_delegateBatch_works() public {
        uint256 privKey1 = 0xA11CE;
        uint256 privKey2 = 0xB0B;
        address signer1 = vm.addr(privKey1);
        address signer2 = vm.addr(privKey2);

        vm.prank(minter);
        token.mint(signer1, 500e18);
        vm.prank(minter);
        token.mint(signer2, 300e18);

        bytes32 delegationTypehash = keccak256(
            "Delegation(address delegatee,uint256 nonce,uint256 expiry)"
        );

        uint256 expiry = block.timestamp + 1 hours;

        // Sign delegation for signer1 → bob
        bytes32 struct1 = keccak256(abi.encode(delegationTypehash, bob, token.nonces(signer1), expiry));
        bytes32 digest1 = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), struct1));
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(privKey1, digest1);

        // Sign delegation for signer2 → bob
        bytes32 struct2 = keccak256(abi.encode(delegationTypehash, bob, token.nonces(signer2), expiry));
        bytes32 digest2 = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), struct2));
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(privKey2, digest2);

        NdiddToken.DelegateSig[] memory sigs = new NdiddToken.DelegateSig[](2);
        sigs[0] = NdiddToken.DelegateSig({delegatee: bob, nonce: token.nonces(signer1), expiry: expiry, v: v1, r: r1, s: s1});
        sigs[1] = NdiddToken.DelegateSig({delegatee: bob, nonce: token.nonces(signer2), expiry: expiry, v: v2, r: r2, s: s2});

        token.delegateBatch(sigs);

        assertEq(token.delegates(signer1), bob);
        assertEq(token.delegates(signer2), bob);
        assertEq(token.getVotes(bob), 800e18);
    }

    function test_delegateBatch_invalidSigReverts() public {
        NdiddToken.DelegateSig[] memory sigs = new NdiddToken.DelegateSig[](1);
        sigs[0] = NdiddToken.DelegateSig({
            delegatee: bob,
            nonce: 0,
            expiry: block.timestamp + 1,
            v: 27,
            r: bytes32(0),
            s: bytes32(0)
        });
        vm.expectRevert();
        token.delegateBatch(sigs);
    }
}
