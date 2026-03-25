// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title CrossChainBridge
/// @notice Upgradeable cross-chain message bridge with EIP-712 signature verification and rate limiting.
contract CrossChainBridge is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    EIP712Upgradeable,
    UUPSUpgradeable
{
    using ECDSA for bytes32;

    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    bytes32 public constant CROSS_CHAIN_MESSAGE_TYPEHASH = keccak256(
        "CrossChainMessage(uint32 srcChain,uint32 dstChain,address sender,address recipient,uint256 amount,uint256 nonce)"
    );

    struct CrossChainMessage {
        uint32 srcChain;
        uint32 dstChain;
        address sender;
        address recipient;
        uint256 amount;
        uint256 nonce;
    }

    /// @notice Tracks the next outgoing nonce per destination chain.
    mapping(uint32 => uint256) public outgoingNonces;
    /// @notice Tracks the next expected incoming nonce per source chain.
    mapping(uint32 => uint256) public incomingNonces;

    /// @notice Rate limiting: last message timestamp per sender.
    mapping(address => uint256) public lastMessageTime;
    /// @notice Minimum interval between messages from the same sender.
    uint256 public rateLimitInterval;

    /// @notice Trusted relayer addresses that may relay incoming messages.
    mapping(address => bool) public trustedRelayers;

    event MessageSent(
        uint32 indexed dstChainId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 nonce
    );
    event MessageReceived(
        uint32 indexed srcChainId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 nonce
    );
    event RelayerUpdated(address indexed relayer, bool trusted);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the bridge.
    /// @param admin Admin address receiving all roles.
    function initialize(address admin) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __EIP712_init("NdiddBridge", "1");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BRIDGE_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        rateLimitInterval = 1 minutes;
    }

    /// @notice Emits a cross-chain message to be relayed.
    /// @param dstChainId Target chain identifier.
    /// @param recipient Recipient address on the destination chain.
    /// @param amount Token amount to bridge.
    function sendMessage(
        uint32 dstChainId,
        address recipient,
        uint256 amount
    ) external payable whenNotPaused {
        require(recipient != address(0), "CrossChainBridge: zero recipient");
        require(amount > 0, "CrossChainBridge: zero amount");
        _enforceRateLimit(msg.sender);

        uint256 nonce = outgoingNonces[dstChainId]++;
        emit MessageSent(dstChainId, msg.sender, recipient, amount, nonce);
    }

    /// @notice Processes an incoming cross-chain message after signature verification.
    /// @param message The decoded cross-chain message.
    /// @param signature EIP-712 signature from a trusted relayer.
    function receiveMessage(
        CrossChainMessage calldata message,
        bytes calldata signature
    ) external whenNotPaused {
        require(message.dstChain == block.chainid, "CrossChainBridge: wrong destination");
        require(
            message.nonce == incomingNonces[message.srcChain],
            "CrossChainBridge: invalid nonce"
        );

        bytes32 structHash = keccak256(
            abi.encode(
                CROSS_CHAIN_MESSAGE_TYPEHASH,
                message.srcChain,
                message.dstChain,
                message.sender,
                message.recipient,
                message.amount,
                message.nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        require(trustedRelayers[signer], "CrossChainBridge: untrusted signer");

        incomingNonces[message.srcChain]++;

        emit MessageReceived(message.srcChain, message.sender, message.recipient, message.amount, message.nonce);
    }

    /// @notice Adds or removes a trusted relayer.
    function setRelayer(address relayer, bool trusted) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(relayer != address(0), "CrossChainBridge: zero address");
        trustedRelayers[relayer] = trusted;
        emit RelayerUpdated(relayer, trusted);
    }

    /// @notice Updates the rate limiting interval.
    function setRateLimitInterval(uint256 interval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rateLimitInterval = interval;
    }

    /// @notice Pauses the bridge.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses the bridge.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /// @dev Enforces a minimum interval between messages per sender.
    function _enforceRateLimit(address sender) internal {
        if (rateLimitInterval == 0) return;
        require(
            block.timestamp >= lastMessageTime[sender] + rateLimitInterval,
            "CrossChainBridge: rate limit exceeded"
        );
        lastMessageTime[sender] = block.timestamp;
    }
}
