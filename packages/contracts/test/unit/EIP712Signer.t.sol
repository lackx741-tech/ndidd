// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {EIP712Signer} from "../../src/signature/EIP712Signer.sol";

contract EIP712SignerTest is Test {
    EIP712Signer public signer;

    address public admin = makeAddr("admin");
    uint256 public alicePrivKey = 0xA11CE;
    address public alice;
    address public bob = makeAddr("bob");

    bytes32 public constant TRANSFER_TYPEHASH = keccak256(
        "Transfer(address from,address to,uint256 amount,uint256 nonce,uint256 deadline)"
    );
    bytes32 public constant BATCH_TRANSFER_TYPEHASH = keccak256(
        "BatchTransfer(Transfer[] transfers)Transfer(address from,address to,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    function setUp() public {
        alice = vm.addr(alicePrivKey);

        EIP712Signer impl = new EIP712Signer();
        bytes memory initData = abi.encodeCall(EIP712Signer.initialize, (admin));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        signer = EIP712Signer(address(proxy));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _domainSep() internal view returns (bytes32) {
        return signer.domainSeparator();
    }

    function _hashTransfer(EIP712Signer.TransferMessage memory m) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(TRANSFER_TYPEHASH, m.from, m.to, m.amount, m.nonce, m.deadline)
        );
    }

    function _signTransfer(
        uint256 privKey,
        EIP712Signer.TransferMessage memory m,
        bytes32 domainSep
    ) internal pure returns (bytes memory) {
        bytes32 structHash = _hashTransfer(m);
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // ── Single Transfer ───────────────────────────────────────────────────────

    function test_verifyTransfer_validSig() public view {
        EIP712Signer.TransferMessage memory m = EIP712Signer.TransferMessage({
            from: alice,
            to: bob,
            amount: 100e18,
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });
        bytes memory sig = _signTransfer(alicePrivKey, m, _domainSep());
        address recovered = signer.verifyTransfer(m, sig);
        assertEq(recovered, alice);
    }

    function test_verifyTransfer_expiredReverts() public {
        EIP712Signer.TransferMessage memory m = EIP712Signer.TransferMessage({
            from: alice,
            to: bob,
            amount: 100e18,
            nonce: 0,
            deadline: block.timestamp - 1
        });
        bytes memory sig = _signTransfer(alicePrivKey, m, _domainSep());
        vm.expectRevert("EIP712Signer: expired");
        signer.verifyTransfer(m, sig);
    }

    // ── Batch Transfer ────────────────────────────────────────────────────────

    function test_verifyBatchTransfer_validSig() public view {
        EIP712Signer.TransferMessage[] memory messages = new EIP712Signer.TransferMessage[](2);
        messages[0] = EIP712Signer.TransferMessage({
            from: alice, to: bob, amount: 50e18, nonce: 0, deadline: block.timestamp + 1 hours
        });
        messages[1] = EIP712Signer.TransferMessage({
            from: alice, to: bob, amount: 75e18, nonce: 1, deadline: block.timestamp + 2 hours
        });

        // Build batch struct hash
        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = _hashTransfer(messages[0]);
        hashes[1] = _hashTransfer(messages[1]);
        bytes32 arrayHash = keccak256(abi.encodePacked(hashes));
        bytes32 batchStructHash = keccak256(abi.encode(BATCH_TRANSFER_TYPEHASH, arrayHash));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSep(), batchStructHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(alicePrivKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        address recovered = signer.verifyBatchTransfer(messages, sig);
        assertEq(recovered, alice);
    }

    function test_verifyBatchTransfer_wrongSigReverts() public view {
        uint256 wrongKey = 0xB0B;
        EIP712Signer.TransferMessage[] memory messages = new EIP712Signer.TransferMessage[](1);
        messages[0] = EIP712Signer.TransferMessage({
            from: alice, to: bob, amount: 50e18, nonce: 0, deadline: block.timestamp + 1 hours
        });

        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = _hashTransfer(messages[0]);
        bytes32 arrayHash = keccak256(abi.encodePacked(hashes));
        bytes32 batchStructHash = keccak256(abi.encode(BATCH_TRANSFER_TYPEHASH, arrayHash));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSep(), batchStructHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        address recovered = signer.verifyBatchTransfer(messages, sig);
        // Should not equal alice — different key signed it
        assertTrue(recovered != alice);
    }

    // ── executeBatchMetaTx ────────────────────────────────────────────────────

    function test_executeBatchMetaTx_works() public {
        // Deploy a simple counter contract for testing
        Counter counter = new Counter();

        address[] memory targets = new address[](2);
        bytes[] memory payloads = new bytes[](2);
        targets[0] = address(counter);
        targets[1] = address(counter);
        payloads[0] = abi.encodeWithSelector(Counter.increment.selector);
        payloads[1] = abi.encodeWithSelector(Counter.increment.selector);

        uint256 nonce = signer.nonces(alice);
        bytes32 itemHash0 = keccak256(abi.encode(targets[0], keccak256(payloads[0])));
        bytes32 itemHash1 = keccak256(abi.encode(targets[1], keccak256(payloads[1])));
        bytes32 batchHash = keccak256(abi.encodePacked(itemHash0, itemHash1));
        bytes32 digest = keccak256(abi.encode(alice, batchHash, nonce));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(alicePrivKey, ethHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(admin);
        signer.executeBatchMetaTx(alice, targets, payloads, sig);

        assertEq(counter.count(), 2);
        assertEq(signer.nonces(alice), 1);
    }

    function test_executeBatchMetaTx_lengthMismatchReverts() public {
        address[] memory targets = new address[](2);
        bytes[] memory payloads = new bytes[](1);
        vm.expectRevert("EIP712Signer: length mismatch");
        vm.prank(admin);
        signer.executeBatchMetaTx(alice, targets, payloads, "");
    }

    function test_executeBatchMetaTx_emptyBatchReverts() public {
        address[] memory targets = new address[](0);
        bytes[] memory payloads = new bytes[](0);
        vm.expectRevert("EIP712Signer: empty batch");
        vm.prank(admin);
        signer.executeBatchMetaTx(alice, targets, payloads, "");
    }

    function test_executeBatchMetaTx_invalidSigReverts() public {
        Counter counter = new Counter();
        address[] memory targets = new address[](1);
        bytes[] memory payloads = new bytes[](1);
        targets[0] = address(counter);
        payloads[0] = abi.encodeWithSelector(Counter.increment.selector);

        bytes memory badSig = abi.encodePacked(bytes32(0), bytes32(0), uint8(27));
        vm.expectRevert("EIP712Signer: invalid signature");
        vm.prank(admin);
        signer.executeBatchMetaTx(alice, targets, payloads, badSig);
    }

    function test_executeBatchMetaTx_replayProtection() public {
        Counter counter = new Counter();
        address[] memory targets = new address[](1);
        bytes[] memory payloads = new bytes[](1);
        targets[0] = address(counter);
        payloads[0] = abi.encodeWithSelector(Counter.increment.selector);

        uint256 nonce = signer.nonces(alice);
        bytes32 itemHash = keccak256(abi.encode(targets[0], keccak256(payloads[0])));
        bytes32 batchHash = keccak256(abi.encodePacked(itemHash));
        bytes32 digest = keccak256(abi.encode(alice, batchHash, nonce));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(alicePrivKey, ethHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(admin);
        signer.executeBatchMetaTx(alice, targets, payloads, sig);

        // Replaying the same sig must fail (nonce incremented)
        vm.expectRevert("EIP712Signer: invalid signature");
        vm.prank(admin);
        signer.executeBatchMetaTx(alice, targets, payloads, sig);
    }

    function test_executeBatchMetaTx_requiresExecutorRole() public {
        address[] memory targets = new address[](1);
        bytes[] memory payloads = new bytes[](1);
        targets[0] = bob;
        payloads[0] = "";
        vm.expectRevert();
        vm.prank(alice);
        signer.executeBatchMetaTx(alice, targets, payloads, "");
    }
}

/// @dev Minimal counter used as a meta-tx target in tests.
contract Counter {
    uint256 public count;
    function increment() external {
        count++;
    }
}
