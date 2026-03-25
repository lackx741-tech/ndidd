// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Minimal IEntryPoint interface needed by the paymaster.
interface IEntryPointPaymaster {
    function depositTo(address account) external payable;
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;
    function balanceOf(address account) external view returns (uint256);
    function getDepositInfo(address account)
        external
        view
        returns (uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime);
    function addStake(uint32 unstakeDelaySec) external payable;
    function unlockStake() external;
    function withdrawStake(address payable withdrawAddress) external;
}

/// @notice Minimal UserOperation struct (must match AccountFactory.sol).
struct PaymasterUserOperation {
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

/// @title NdiddPaymaster
/// @notice ERC-4337 Verifying Paymaster that sponsors UserOperations pre-approved
///         by a trusted signer. Optionally enforces a minimum NDIDD token balance
///         for the sender's smart account.
///
/// Flow:
///   1. Off-chain backend signs a (userOpHash, validUntil, validAfter) tuple.
///   2. The bundler includes this signature in `paymasterAndData`.
///   3. `validatePaymasterUserOp` verifies the signature and time bounds.
///   4. `postOp` is a no-op (no additional accounting needed).
///
/// paymasterAndData layout (after paymaster address prefix, 20 bytes):
///   [0:6]   validUntil  (uint48, big-endian)
///   [6:12]  validAfter  (uint48, big-endian)
///   [12:77] signature   (65 bytes, ECDSA)
contract NdiddPaymaster is AccessControl, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    // ── Roles ────────────────────────────────────────────────────────────────
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ── State ─────────────────────────────────────────────────────────────────
    IEntryPointPaymaster public immutable entryPoint;

    /// @notice Minimum NDIDD token balance required to be sponsored (0 = disabled).
    uint256 public minTokenBalance;
    /// @notice NDIDD token contract (zero address = token check disabled).
    address public ndiddToken;

    // ── Events ────────────────────────────────────────────────────────────────
    event UserOperationSponsored(address indexed sender, uint256 actualGasCost);
    event Deposited(address indexed depositor, uint256 amount);
    event Withdrawn(address indexed recipient, uint256 amount);
    event MinTokenBalanceUpdated(uint256 oldMin, uint256 newMin);
    event SignerUpdated(address indexed signer, bool granted);

    // ── Errors ────────────────────────────────────────────────────────────────
    error InvalidSignature();
    error SignatureExpired();
    error SignatureNotYetValid();
    error InsufficientTokenBalance(address sender, uint256 required, uint256 actual);
    error OnlyEntryPoint();
    error InvalidPaymasterDataLength();

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(
        IEntryPointPaymaster entryPoint_,
        address admin,
        address signer_,
        address ndiddToken_,
        uint256 minTokenBalance_
    ) {
        entryPoint = entryPoint_;
        ndiddToken = ndiddToken_;
        minTokenBalance = minTokenBalance_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SIGNER_ROLE, signer_);
        _grantRole(DEPOSITOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ── ERC-4337 Paymaster interface ──────────────────────────────────────────

    /// @notice Called by the EntryPoint during UserOperation validation.
    /// @param userOp     The UserOperation being validated.
    /// @param userOpHash Hash of the UserOperation (provided by EntryPoint).
    /// @param maxCost    Maximum gas cost (in wei) the paymaster may be charged.
    /// @return context       Encoded sender address, passed to postOp.
    /// @return validationData Packed (sigFail | validUntil | validAfter).
    function validatePaymasterUserOp(
        PaymasterUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external whenNotPaused returns (bytes memory context, uint256 validationData) {
        if (msg.sender != address(entryPoint)) revert OnlyEntryPoint();
        (maxCost); // acknowledged — gas limit checked by EntryPoint

        // ── Parse paymasterAndData ───────────────────────────────────────────
        // paymasterAndData = [paymaster address (20 bytes)] ++ [validUntil (6)] ++ [validAfter (6)] ++ [sig (65)]
        bytes calldata data = userOp.paymasterAndData;
        // data starts after the 20-byte address prefix
        if (data.length < 20 + 6 + 6 + 65) revert InvalidPaymasterDataLength();

        uint48 validUntil = uint48(bytes6(data[20:26]));
        uint48 validAfter = uint48(bytes6(data[26:32]));
        bytes calldata sig = data[32:97];

        // ── Verify time bounds ────────────────────────────────────────────────
        // (We return packed validationData so the EntryPoint handles time check on-chain,
        //  but we also do an early revert for clarity.)
        if (validUntil != 0 && block.timestamp > validUntil) revert SignatureExpired();
        if (validAfter != 0 && block.timestamp < validAfter) revert SignatureNotYetValid();

        // ── Verify signer ─────────────────────────────────────────────────────
        bytes32 hash = _getPaymasterHash(userOpHash, validUntil, validAfter);
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(hash);
        address recovered = ethSignedHash.recover(sig);
        bool sigFailed = !hasRole(SIGNER_ROLE, recovered);

        // ── Optional token balance check ──────────────────────────────────────
        if (!sigFailed && ndiddToken != address(0) && minTokenBalance > 0) {
            uint256 balance = _tokenBalance(userOp.sender);
            if (balance < minTokenBalance) {
                revert InsufficientTokenBalance(userOp.sender, minTokenBalance, balance);
            }
        }

        // Pack: sigFailed (1 bit) | validUntil (48 bits) | validAfter (48 bits)
        validationData = _packValidationData(sigFailed, validUntil, validAfter);
        context = abi.encode(userOp.sender);
    }

    /// @notice Called by the EntryPoint after UserOperation execution.
    /// @param context    The context returned by validatePaymasterUserOp.
    /// @param actualGasCost Actual gas cost charged.
    function postOp(
        PostOpMode, /* mode */
        bytes calldata context,
        uint256 actualGasCost
    ) external {
        if (msg.sender != address(entryPoint)) revert OnlyEntryPoint();
        address sender = abi.decode(context, (address));
        emit UserOperationSponsored(sender, actualGasCost);
    }

    // ── Admin functions ───────────────────────────────────────────────────────

    /// @notice Deposits ETH into the EntryPoint on behalf of this paymaster.
    function deposit() external payable onlyRole(DEPOSITOR_ROLE) nonReentrant {
        entryPoint.depositTo{value: msg.value}(address(this));
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraws ETH from the EntryPoint to a recipient.
    function withdrawTo(address payable recipient, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        entryPoint.withdrawTo(recipient, amount);
        emit Withdrawn(recipient, amount);
    }

    /// @notice Stakes ETH at the EntryPoint (required for paymasters).
    function addStake(uint32 unstakeDelaySec) external payable onlyRole(DEFAULT_ADMIN_ROLE) {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    /// @notice Unlocks the stake (begins unbonding period).
    function unlockStake() external onlyRole(DEFAULT_ADMIN_ROLE) {
        entryPoint.unlockStake();
    }

    /// @notice Withdraws unlocked stake.
    function withdrawStake(address payable recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        entryPoint.withdrawStake(recipient);
    }

    /// @notice Updates the minimum NDIDD token balance required.
    function setMinTokenBalance(uint256 newMin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit MinTokenBalanceUpdated(minTokenBalance, newMin);
        minTokenBalance = newMin;
    }

    /// @notice Updates the NDIDD token contract address.
    function setNdiddToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ndiddToken = token;
    }

    /// @notice Pauses paymaster (stops sponsoring).
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses paymaster.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    /// @notice Returns this paymaster's deposit balance at the EntryPoint.
    function getDeposit() external view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    /// @notice Computes the hash signed by the paymaster signer.
    function getPaymasterHash(bytes32 userOpHash, uint48 validUntil, uint48 validAfter)
        external
        view
        returns (bytes32)
    {
        return _getPaymasterHash(userOpHash, validUntil, validAfter);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _getPaymasterHash(
        bytes32 userOpHash,
        uint48 validUntil,
        uint48 validAfter
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(userOpHash, address(this), block.chainid, validUntil, validAfter));
    }

    function _packValidationData(
        bool sigFailed,
        uint48 validUntil,
        uint48 validAfter
    ) internal pure returns (uint256) {
        return (sigFailed ? 1 : 0) | (uint256(validUntil) << 160) | (uint256(validAfter) << 208);
    }

    function _tokenBalance(address account) internal view returns (uint256) {
        (bool ok, bytes memory result) = ndiddToken.staticcall(
            abi.encodeWithSignature("balanceOf(address)", account)
        );
        if (!ok || result.length < 32) return 0;
        return abi.decode(result, (uint256));
    }

    receive() external payable {}
}

/// @dev Post-operation mode enum (mirrors ERC-4337 spec).
enum PostOpMode {
    opSucceeded,
    opReverted,
    postOpReverted
}
