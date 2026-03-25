// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {NdiddVault} from "../../src/vault/NdiddVault.sol";
import {IStrategy} from "../../src/vault/NdiddVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Minimal ERC20 for testing.
contract MockToken is ERC20 {
    constructor() ERC20("Mock", "MCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Trivial strategy that holds assets in-contract.
contract MockStrategy is IStrategy {
    IERC20 public asset;
    uint256 private _total;

    constructor(address asset_) {
        asset = IERC20(asset_);
    }

    function deposit(uint256 amount) external override {
        asset.transferFrom(msg.sender, address(this), amount);
        _total += amount;
    }

    function withdraw(uint256 amount) external override {
        require(_total >= amount, "MockStrategy: insufficient");
        _total -= amount;
        asset.transfer(msg.sender, amount);
    }

    function harvest() external override returns (uint256) {
        return 0;
    }

    function totalAssets() external view override returns (uint256) {
        return _total;
    }
}

contract NdiddVaultTest is Test {
    NdiddVault public vault;
    MockToken public asset;
    MockStrategy public strategy;

    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    function setUp() public {
        asset = new MockToken();
        strategy = new MockStrategy(address(asset));

        NdiddVault impl = new NdiddVault();
        bytes memory initData = abi.encodeCall(NdiddVault.initialize, (IERC20(address(asset)), address(strategy), admin));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        vault = NdiddVault(address(proxy));

        asset.mint(alice, 100_000e18);
        asset.mint(bob, 100_000e18);

        vm.prank(alice);
        asset.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        asset.approve(address(vault), type(uint256).max);
    }

    function test_initialize() public view {
        assertEq(vault.name(), "Ndidd Vault");
        assertEq(vault.symbol(), "ndVLT");
        assertEq(vault.asset(), address(asset));
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), admin));
        assertEq(vault.performanceFee(), 1_000);
        assertEq(vault.managementFee(), 200);
    }

    function test_deposit() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1_000e18, alice);
        assertGt(shares, 0);
        assertEq(vault.balanceOf(alice), shares);
        assertEq(asset.balanceOf(address(vault)), 1_000e18);
    }

    function test_withdraw() public {
        vm.prank(alice);
        vault.deposit(1_000e18, alice);

        uint256 sharesBefore = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 assets = vault.withdraw(500e18, alice, alice);

        assertEq(assets, 500e18);
        assertLt(vault.balanceOf(alice), sharesBefore);
    }

    function test_redeem() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1_000e18, alice);

        vm.prank(alice);
        uint256 assets = vault.redeem(shares / 2, alice, alice);
        assertGt(assets, 0);
    }

    function test_totalAssets() public {
        vm.prank(alice);
        vault.deposit(1_000e18, alice);
        assertEq(vault.totalAssets(), 1_000e18);
    }

    function test_setStrategy() public {
        MockStrategy newStrategy = new MockStrategy(address(asset));
        vm.prank(admin);
        vault.setStrategy(address(newStrategy));
        assertEq(address(vault.strategy()), address(newStrategy));
    }

    function test_setStrategy_revertsIfNotStrategist() public {
        MockStrategy newStrategy = new MockStrategy(address(asset));
        vm.expectRevert();
        vm.prank(alice);
        vault.setStrategy(address(newStrategy));
    }

    function test_setFees() public {
        vm.prank(admin);
        vault.setFees(500, 100);
        assertEq(vault.performanceFee(), 500);
        assertEq(vault.managementFee(), 100);
    }

    function test_setFees_revertsIfTooHigh() public {
        vm.expectRevert("NdiddVault: fee too high");
        vm.prank(admin);
        vault.setFees(2_001, 0);
    }

    function test_pause_preventsDeposit() public {
        vm.prank(admin);
        vault.pause();

        vm.expectRevert();
        vm.prank(alice);
        vault.deposit(100e18, alice);
    }

    function test_rateLimit() public {
        vm.prank(admin);
        vault.setMaxDepositPerBlock(500e18);

        vm.prank(alice);
        vault.deposit(500e18, alice);

        vm.expectRevert("NdiddVault: deposit rate limit exceeded");
        vm.prank(alice);
        vault.deposit(1e18, alice);
    }
}
