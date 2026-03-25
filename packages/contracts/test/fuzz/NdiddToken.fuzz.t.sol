// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {NdiddToken} from "../../src/token/NdiddToken.sol";

contract NdiddTokenFuzzTest is Test {
    NdiddToken public token;
    address public admin = makeAddr("admin");

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    function setUp() public {
        NdiddToken impl = new NdiddToken();
        bytes memory initData = abi.encodeCall(NdiddToken.initialize, (admin));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        token = NdiddToken(address(proxy));
    }

    /// @notice Fuzzes mint: ensures total supply never exceeds MAX_SUPPLY and balance updates correctly.
    function testFuzz_mint(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount > 0 && amount <= token.MAX_SUPPLY());

        vm.prank(admin);
        token.mint(to, amount);

        assertEq(token.balanceOf(to), amount);
        assertLe(token.totalSupply(), token.MAX_SUPPLY());
    }

    /// @notice Fuzzes transfers: verifies balance conservation.
    function testFuzz_transfer(address from, address to, uint256 amount) public {
        vm.assume(from != address(0) && to != address(0) && from != to);
        vm.assume(amount > 0 && amount <= token.MAX_SUPPLY());

        vm.prank(admin);
        token.mint(from, amount);

        uint256 fromBefore = token.balanceOf(from);
        uint256 toBefore = token.balanceOf(to);

        vm.prank(from);
        token.transfer(to, amount);

        assertEq(token.balanceOf(from), fromBefore - amount);
        assertEq(token.balanceOf(to), toBefore + amount);
    }

    /// @notice Fuzzes burn: balance decreases by burned amount, supply stays consistent.
    function testFuzz_burnFromBalance(uint256 amount) public {
        vm.assume(amount > 0 && amount <= token.MAX_SUPPLY());

        address holder = makeAddr("holder");
        vm.prank(admin);
        token.mint(holder, amount);

        uint256 burnAmt = amount / 2;
        if (burnAmt == 0) burnAmt = 1;

        uint256 supplyBefore = token.totalSupply();
        vm.prank(holder);
        token.burn(burnAmt);

        assertEq(token.balanceOf(holder), amount - burnAmt);
        assertEq(token.totalSupply(), supplyBefore - burnAmt);
    }

    /// @notice Fuzz: minting beyond MAX_SUPPLY always reverts.
    function testFuzz_mintBeyondMaxSupplyReverts(uint256 excess) public {
        uint256 maxSupply = token.MAX_SUPPLY();
        vm.assume(excess > 0 && excess <= type(uint256).max - maxSupply);

        vm.prank(admin);
        token.mint(admin, maxSupply);

        vm.expectRevert("NdiddToken: max supply exceeded");
        vm.prank(admin);
        token.mint(admin, excess);
    }
}
