// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {AccountFactory, SmartAccount, IEntryPoint, UserOperation} from "../../src/aa/AccountFactory.sol";

/// @dev Minimal mock EntryPoint for unit testing.
contract MockEntryPoint is IEntryPoint {
    mapping(address => uint256) public balances;
    mapping(address => mapping(uint192 => uint256)) private _nonces;

    function getUserOpHash(UserOperation calldata) external pure returns (bytes32) {
        return keccak256("test-user-op-hash");
    }

    function handleOps(UserOperation[] calldata, address payable) external {}

    function getNonce(address sender, uint192 key) external view returns (uint256) {
        return _nonces[sender][key];
    }

    function depositTo(address account) external payable {
        balances[account] += msg.value;
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
}

contract AccountFactoryTest is Test {
    AccountFactory public factory;
    MockEntryPoint public entryPoint;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    uint256 public alicePrivKey = 0xA11CE;

    function setUp() public {
        entryPoint = new MockEntryPoint();
        factory = new AccountFactory(IEntryPoint(address(entryPoint)));
    }

    // ── Factory tests ─────────────────────────────────────────────────────────

    function test_factory_hasCorrectEntryPoint() public view {
        assertEq(address(factory.entryPoint()), address(entryPoint));
    }

    function test_createAccount_deploysSmartAccount() public {
        SmartAccount account = factory.createAccount(alice, 0);
        assertNotEq(address(account), address(0));
        assertTrue(address(account).code.length > 0);
    }

    function test_createAccount_setsOwner() public {
        SmartAccount account = factory.createAccount(alice, 0);
        assertEq(account.owner(), alice);
    }

    function test_createAccount_setsEntryPoint() public {
        SmartAccount account = factory.createAccount(alice, 0);
        assertEq(address(account.entryPoint()), address(entryPoint));
    }

    function test_createAccount_idempotent() public {
        SmartAccount account1 = factory.createAccount(alice, 0);
        SmartAccount account2 = factory.createAccount(alice, 0);
        assertEq(address(account1), address(account2));
    }

    function test_getAddress_matchesDeployed() public {
        address predicted = factory.getAddress(alice, 0);
        SmartAccount deployed = factory.createAccount(alice, 0);
        assertEq(predicted, address(deployed));
    }

    function test_getAddress_differentSalts() public {
        address addr0 = factory.getAddress(alice, 0);
        address addr1 = factory.getAddress(alice, 1);
        assertTrue(addr0 != addr1);
    }

    function test_getAddress_differentOwners() public {
        address addrAlice = factory.getAddress(alice, 0);
        address addrBob = factory.getAddress(bob, 0);
        assertTrue(addrAlice != addrBob);
    }

    function test_createAccount_emitsEvent() public {
        address predicted = factory.getAddress(alice, 42);
        vm.expectEmit(true, true, false, true);
        emit AccountFactory.AccountCreated(predicted, alice, 42);
        factory.createAccount(alice, 42);
    }

    // ── SmartAccount tests ────────────────────────────────────────────────────

    function test_execute_calledByOwner() public {
        SmartAccount account = factory.createAccount(alice, 0);
        vm.deal(address(account), 1 ether);

        vm.prank(alice);
        account.execute(bob, 0.1 ether, "");

        assertEq(bob.balance, 0.1 ether);
    }

    function test_execute_calledByEntryPoint() public {
        SmartAccount account = factory.createAccount(alice, 0);
        vm.deal(address(account), 1 ether);

        vm.prank(address(entryPoint));
        account.execute(bob, 0.1 ether, "");

        assertEq(bob.balance, 0.1 ether);
    }

    function test_execute_revertsIfUnauthorized() public {
        SmartAccount account = factory.createAccount(alice, 0);
        vm.deal(address(account), 1 ether);

        vm.expectRevert("SmartAccount: not authorized");
        vm.prank(bob);
        account.execute(bob, 0.1 ether, "");
    }

    function test_executeBatch_works() public {
        SmartAccount account = factory.createAccount(alice, 0);
        vm.deal(address(account), 1 ether);

        address[] memory dests = new address[](2);
        bytes[] memory data = new bytes[](2);
        dests[0] = alice;
        dests[1] = bob;
        data[0] = "";
        data[1] = "";

        vm.prank(alice);
        account.executeBatch(dests, data);
    }

    function test_executeBatch_revertsOnLengthMismatch() public {
        SmartAccount account = factory.createAccount(alice, 0);

        address[] memory dests = new address[](2);
        bytes[] memory data = new bytes[](1);

        vm.expectRevert("SmartAccount: length mismatch");
        vm.prank(alice);
        account.executeBatch(dests, data);
    }

    function test_transferOwnership_works() public {
        SmartAccount account = factory.createAccount(alice, 0);

        vm.prank(alice);
        account.transferOwnership(bob);

        assertEq(account.owner(), bob);
    }

    function test_transferOwnership_revertsIfNotOwner() public {
        SmartAccount account = factory.createAccount(alice, 0);

        vm.expectRevert("SmartAccount: not owner");
        vm.prank(bob);
        account.transferOwnership(bob);
    }

    function test_transferOwnership_revertsZeroAddress() public {
        SmartAccount account = factory.createAccount(alice, 0);

        vm.expectRevert("SmartAccount: zero owner");
        vm.prank(alice);
        account.transferOwnership(address(0));
    }

    function test_getDeposit_returnsEntryPointBalance() public {
        SmartAccount account = factory.createAccount(alice, 0);
        vm.deal(address(account), 1 ether);
        vm.prank(address(account));
        entryPoint.depositTo{value: 0.5 ether}(address(account));
        assertEq(account.getDeposit(), 0.5 ether);
    }

    function test_validateUserOp_validSignature() public {
        // Deploy account for alicePrivKey's address
        address aliceAddr = vm.addr(alicePrivKey);
        SmartAccount account = factory.createAccount(aliceAddr, 0);
        vm.deal(address(account), 1 ether);

        UserOperation memory userOp;
        userOp.sender = address(account);
        userOp.nonce = 0;
        userOp.initCode = "";
        userOp.callData = "";
        userOp.callGasLimit = 100_000;
        userOp.verificationGasLimit = 100_000;
        userOp.preVerificationGas = 21_000;
        userOp.maxFeePerGas = 1 gwei;
        userOp.maxPriorityFeePerGas = 1 gwei;
        userOp.paymasterAndData = "";

        bytes32 userOpHash = keccak256("test-user-op-hash");
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(alicePrivKey, ethHash);
        userOp.signature = abi.encodePacked(r, s, v);

        vm.prank(address(entryPoint));
        uint256 result = account.validateUserOp(userOp, userOpHash, 0);
        assertEq(result, 0); // SIG_VALIDATION_SUCCESS
    }

    function test_validateUserOp_invalidSignature() public {
        SmartAccount account = factory.createAccount(alice, 0);
        vm.deal(address(account), 1 ether);

        UserOperation memory userOp;
        userOp.sender = address(account);
        userOp.signature = abi.encodePacked(bytes32(0), bytes32(0), uint8(27)); // garbage sig

        bytes32 userOpHash = keccak256("test-user-op-hash");

        vm.prank(address(entryPoint));
        uint256 result = account.validateUserOp(userOp, userOpHash, 0);
        assertEq(result, 1); // SIG_VALIDATION_FAILED
    }

    function test_validateUserOp_prefundsSentToEntryPoint() public {
        SmartAccount account = factory.createAccount(alice, 0);
        uint256 prefund = 0.1 ether;
        vm.deal(address(account), prefund);

        UserOperation memory userOp;
        userOp.sender = address(account);
        userOp.signature = abi.encodePacked(bytes32(0), bytes32(0), uint8(27));

        vm.prank(address(entryPoint));
        account.validateUserOp(userOp, bytes32(0), prefund);

        assertEq(address(entryPoint).balance, prefund);
    }

    function test_receive_acceptsEther() public {
        SmartAccount account = factory.createAccount(alice, 0);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(account).call{value: 0.5 ether}("");
        assertTrue(ok);
        assertEq(address(account).balance, 0.5 ether);
    }

    // ── Fuzz tests ────────────────────────────────────────────────────────────

    function testFuzz_getAddress_deterministicAcrossOwnerAndSalt(address owner, uint256 salt) public view {
        address addr1 = factory.getAddress(owner, salt);
        address addr2 = factory.getAddress(owner, salt);
        assertEq(addr1, addr2);
    }
}
