// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title EIP712Signer
/// @notice Upgradeable EIP-712 utility for typed structured data signing and meta-transaction execution.
contract EIP712Signer is Initializable, EIP712Upgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    using ECDSA for bytes32;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    bytes32 public constant TRANSFER_TYPEHASH = keccak256(
        "Transfer(address from,address to,uint256 amount,uint256 nonce,uint256 deadline)"
    );
    bytes32 public constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );
    bytes32 public constant BRIDGE_MESSAGE_TYPEHASH = keccak256(
        "BridgeMessage(address sender,uint32 dstChain,address recipient,uint256 amount,uint256 nonce)"
    );
    /// @notice Typehash for a batch of Transfer messages.
    bytes32 public constant BATCH_TRANSFER_TYPEHASH = keccak256(
        "BatchTransfer(Transfer[] transfers)Transfer(address from,address to,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    struct TransferMessage {
        address from;
        address to;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    struct PermitMessage {
        address owner;
        address spender;
        uint256 value;
        uint256 nonce;
        uint256 deadline;
    }

    struct BridgeMessage {
        address sender;
        uint32 dstChain;
        address recipient;
        uint256 amount;
        uint256 nonce;
    }

    /// @notice Nonce per address for replay protection.
    mapping(address => uint256) public nonces;

    event MetaTxExecuted(address indexed from, address indexed to, bool success);
    event NonceConsumed(address indexed account, uint256 nonce);
    event BatchMetaTxExecuted(address indexed from, uint256 count);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the EIP712 signer.
    /// @param admin Admin address.
    function initialize(address admin) external initializer {
        __EIP712_init("NdiddProtocol", "1");
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
    }

    /// @notice Verifies a Transfer message and returns the signer.
    /// @param message The transfer message struct.
    /// @param sig EIP-712 signature.
    /// @return signer The recovered signer address.
    function verifyTransfer(
        TransferMessage calldata message,
        bytes calldata sig
    ) external view returns (address signer) {
        require(block.timestamp <= message.deadline, "EIP712Signer: expired");
        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_TYPEHASH,
                message.from,
                message.to,
                message.amount,
                message.nonce,
                message.deadline
            )
        );
        signer = _hashTypedDataV4(structHash).recover(sig);
    }

    /// @notice Verifies a Permit message and returns the signer.
    /// @param message The permit message struct.
    /// @param sig EIP-712 signature.
    /// @return signer The recovered signer address.
    function verifyPermit(
        PermitMessage calldata message,
        bytes calldata sig
    ) external view returns (address signer) {
        require(block.timestamp <= message.deadline, "EIP712Signer: expired");
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                message.owner,
                message.spender,
                message.value,
                message.nonce,
                message.deadline
            )
        );
        signer = _hashTypedDataV4(structHash).recover(sig);
    }

    /// @notice Verifies a BridgeMessage and returns the signer.
    /// @param message The bridge message struct.
    /// @param sig EIP-712 signature.
    /// @return signer The recovered signer address.
    function verifyBridgeMessage(
        BridgeMessage calldata message,
        bytes calldata sig
    ) external view returns (address signer) {
        bytes32 structHash = keccak256(
            abi.encode(
                BRIDGE_MESSAGE_TYPEHASH,
                message.sender,
                message.dstChain,
                message.recipient,
                message.amount,
                message.nonce
            )
        );
        signer = _hashTypedDataV4(structHash).recover(sig);
    }

    /// @notice Executes a meta-transaction on behalf of `from`.
    /// @dev `from` must sign: keccak256(abi.encode(from, to, data, nonce)) as an ETH signed message.
    /// @param from The original transaction sender.
    /// @param to The target contract to call.
    /// @param data Calldata to forward.
    /// @param sig Signature authorizing this meta-tx.
    function executeMetaTx(
        address from,
        address to,
        bytes calldata data,
        bytes calldata sig
    ) external onlyRole(EXECUTOR_ROLE) {
        require(from != address(0) && to != address(0), "EIP712Signer: zero address");

        uint256 nonce = nonces[from];
        bytes32 digest = keccak256(abi.encode(from, to, keccak256(data), nonce));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        address signer = ethSignedHash.recover(sig);
        require(signer == from, "EIP712Signer: invalid signature");

        nonces[from]++;
        emit NonceConsumed(from, nonce);

        (bool success, ) = to.call(abi.encodePacked(data, from));
        emit MetaTxExecuted(from, to, success);
        require(success, "EIP712Signer: meta-tx failed");
    }

    /// @notice Returns the EIP-712 domain separator.
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Verifies a batch of Transfer messages signed under a single EIP-712 signature.
    /// @dev The batch digest is: hashTypedDataV4(keccak256(BATCH_TRANSFER_TYPEHASH || keccak256(encodedTransfers)))
    ///      where `encodedTransfers` is the tightly packed array of individual Transfer struct hashes.
    /// @param messages The array of TransferMessage structs.
    /// @param sig Single EIP-712 signature over the whole batch.
    /// @return signer The recovered signer address.
    function verifyBatchTransfer(
        TransferMessage[] calldata messages,
        bytes calldata sig
    ) external view returns (address signer) {
        bytes32 structHash = _hashBatchTransfer(messages);
        signer = _hashTypedDataV4(structHash).recover(sig);
    }

    /// @notice Executes multiple meta-transactions in a single call, all authorized by `from`.
    /// @dev Uses Ethereum personal_sign format ("\x19Ethereum Signed Message:\n32") for the batch
    ///      authorization, consistent with `executeMetaTx`. The sender address `from` is appended
    ///      to each payload via `abi.encodePacked(payload, from)` — target functions that need to
    ///      identify the original sender should read it from the final 20 bytes of `msg.data`.
    /// @param from The original sender who signed the batch.
    /// @param targets The target contracts to call.
    /// @param payloads The calldata for each target.
    /// @param sig Signature over keccak256(abi.encode(from, keccak256(encodedBatch), nonce)).
    function executeBatchMetaTx(
        address from,
        address[] calldata targets,
        bytes[] calldata payloads,
        bytes calldata sig
    ) external onlyRole(EXECUTOR_ROLE) {
        require(from != address(0), "EIP712Signer: zero address");
        require(targets.length == payloads.length, "EIP712Signer: length mismatch");
        require(targets.length > 0, "EIP712Signer: empty batch");

        uint256 nonce = nonces[from];

        // Build batch digest
        bytes32 batchHash;
        {
            bytes memory encoded;
            for (uint256 i = 0; i < targets.length; i++) {
                encoded = abi.encodePacked(
                    encoded,
                    keccak256(abi.encode(targets[i], keccak256(payloads[i])))
                );
            }
            batchHash = keccak256(encoded);
        }

        bytes32 digest = keccak256(abi.encode(from, batchHash, nonce));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        address recovered = ethSignedHash.recover(sig);
        require(recovered == from, "EIP712Signer: invalid signature");

        nonces[from]++;
        emit NonceConsumed(from, nonce);

        for (uint256 i = 0; i < targets.length; i++) {
            require(targets[i] != address(0), "EIP712Signer: zero target");
            (bool success, ) = targets[i].call(abi.encodePacked(payloads[i], from));
            require(success, "EIP712Signer: batch call failed");
        }
        emit BatchMetaTxExecuted(from, targets.length);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /// @dev Hashes a single TransferMessage for use in the batch hash.
    function _hashTransferMessage(TransferMessage calldata m) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(TRANSFER_TYPEHASH, m.from, m.to, m.amount, m.nonce, m.deadline)
        );
    }

    /// @dev Hashes an array of TransferMessages into the BatchTransfer struct hash.
    function _hashBatchTransfer(TransferMessage[] calldata messages) internal pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](messages.length);
        for (uint256 i = 0; i < messages.length; i++) {
            hashes[i] = _hashTransferMessage(messages[i]);
        }
        bytes32 arrayHash = keccak256(abi.encodePacked(hashes));
        return keccak256(abi.encode(BATCH_TRANSFER_TYPEHASH, arrayHash));
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
