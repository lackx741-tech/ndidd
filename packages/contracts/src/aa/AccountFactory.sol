// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @notice Minimal IEntryPoint interface (ERC-4337).
interface IEntryPoint {
    function getUserOpHash(UserOperation calldata userOp) external view returns (bytes32);
    function handleOps(UserOperation[] calldata ops, address payable beneficiary) external;
    function getNonce(address sender, uint192 key) external view returns (uint256);
    function depositTo(address account) external payable;
}

/// @notice ERC-4337 UserOperation struct.
struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

/// @title SmartAccount
/// @notice ERC-4337 smart account with owner-based ECDSA validation and batch execution.
contract SmartAccount {
    using ECDSA for bytes32;

    IEntryPoint public immutable entryPoint;
    address public owner;

    uint256 private constant SIG_VALIDATION_FAILED = 1;
    uint256 private constant SIG_VALIDATION_SUCCESS = 0;

    event AccountInitialized(IEntryPoint indexed entryPoint, address indexed owner);
    event Executed(address indexed dest, uint256 value, bytes data);
    event BatchExecuted(address[] dest, bytes[] data);

    modifier onlyEntryPointOrOwner() {
        require(
            msg.sender == address(entryPoint) || msg.sender == owner,
            "SmartAccount: not authorized"
        );
        _;
    }

    /// @notice Deploys a SmartAccount. Called by AccountFactory via CREATE2.
    /// @param entryPoint_ The ERC-4337 entry point contract.
    /// @param owner_ The EOA that controls this account.
    constructor(IEntryPoint entryPoint_, address owner_) {
        entryPoint = entryPoint_;
        owner = owner_;
        emit AccountInitialized(entryPoint_, owner_);
    }

    receive() external payable {}

    /// @notice Executes a single call from this account.
    function execute(address dest, uint256 value, bytes calldata data) external onlyEntryPointOrOwner {
        (bool ok, bytes memory result) = dest.call{value: value}(data);
        if (!ok) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        emit Executed(dest, value, data);
    }

    /// @notice Executes multiple calls atomically.
    function executeBatch(address[] calldata dest, bytes[] calldata data) external onlyEntryPointOrOwner {
        require(dest.length == data.length, "SmartAccount: length mismatch");
        for (uint256 i = 0; i < dest.length; i++) {
            (bool ok, bytes memory result) = dest[i].call(data[i]);
            if (!ok) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
        }
        emit BatchExecuted(dest, data);
    }

    /// @notice Validates a UserOperation signature (ERC-4337 interface).
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        require(msg.sender == address(entryPoint), "SmartAccount: only entryPoint");

        validationData = _validateSignature(userOp, userOpHash);

        if (missingAccountFunds > 0) {
            (bool ok, ) = payable(address(entryPoint)).call{value: missingAccountFunds}("");
            require(ok, "SmartAccount: prefund failed");
        }
    }

    /// @notice Validates paymaster user operation (stub — override in paymaster subclass).
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external view returns (bytes memory context, uint256 validationData) {
        (userOp, userOpHash, maxCost); // silence unused warnings
        return ("", SIG_VALIDATION_SUCCESS);
    }

    /// @notice Returns the entry point deposit balance.
    function getDeposit() external view returns (uint256) {
        return entryPoint.getNonce(address(this), 0);
    }

    /// @notice Transfers ownership to a new address.
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "SmartAccount: not owner");
        require(newOwner != address(0), "SmartAccount: zero owner");
        owner = newOwner;
    }

    /// @dev Verifies the UserOperation signature matches the owner.
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view returns (uint256) {
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        address recovered = hash.recover(userOp.signature);
        if (recovered != owner) return SIG_VALIDATION_FAILED;
        return SIG_VALIDATION_SUCCESS;
    }
}

/// @title AccountFactory
/// @notice Deploys SmartAccount instances deterministically via CREATE2.
contract AccountFactory {
    IEntryPoint public immutable entryPoint;

    event AccountCreated(address indexed account, address indexed owner, uint256 salt);

    constructor(IEntryPoint entryPoint_) {
        entryPoint = entryPoint_;
    }

    /// @notice Deploys or returns the existing SmartAccount for a given owner + salt.
    /// @param owner Account owner address.
    /// @param salt CREATE2 salt for deterministic deployment.
    /// @return account The SmartAccount address (deployed or pre-existing).
    function createAccount(address owner, uint256 salt) external returns (SmartAccount account) {
        address predicted = getAddress(owner, salt);
        if (predicted.code.length > 0) {
            return SmartAccount(payable(predicted));
        }
        account = new SmartAccount{salt: bytes32(salt)}(entryPoint, owner);
        emit AccountCreated(address(account), owner, salt);
    }

    /// @notice Computes the deterministic address for a given owner + salt.
    function getAddress(address owner, uint256 salt) public view returns (address) {
        bytes memory creationCode = abi.encodePacked(
            type(SmartAccount).creationCode,
            abi.encode(entryPoint, owner)
        );
        return Create2.computeAddress(bytes32(salt), keccak256(creationCode), address(this));
    }
}
