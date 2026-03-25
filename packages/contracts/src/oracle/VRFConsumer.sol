// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @notice Minimal Chainlink VRF Coordinator v2 interface.
interface VRFCoordinatorV2Interface {
    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId);
}

/// @title VRFConsumer
/// @notice Upgradeable Chainlink VRF v2 consumer for on-chain randomness.
contract VRFConsumer is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant VRF_MANAGER_ROLE = keccak256("VRF_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    VRFCoordinatorV2Interface public vrfCoordinator;
    bytes32 public keyHash;
    uint64 public subscriptionId;
    uint32 public callbackGasLimit;
    uint16 public requestConfirmations;
    uint32 public numWords;

    /// @notice Maps requestId to the address that initiated the request.
    mapping(uint256 => address) public requestToSender;
    /// @notice Maps requestId to the fulfilled random words.
    mapping(uint256 => uint256[]) public requestToResult;

    event RandomnessRequested(uint256 indexed requestId, address indexed requester);
    event RandomnessFulfilled(uint256 indexed requestId, uint256[] randomWords);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the VRF consumer.
    /// @param admin Admin address.
    /// @param coordinator_ Chainlink VRF coordinator address.
    /// @param keyHash_ VRF key hash for the lane.
    /// @param subscriptionId_ Funded VRF subscription ID.
    function initialize(
        address admin,
        address coordinator_,
        bytes32 keyHash_,
        uint64 subscriptionId_
    ) external initializer {
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VRF_MANAGER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        vrfCoordinator = VRFCoordinatorV2Interface(coordinator_);
        keyHash = keyHash_;
        subscriptionId = subscriptionId_;
        callbackGasLimit = 200_000;
        requestConfirmations = 3;
        numWords = 1;
    }

    /// @notice Requests random words from Chainlink VRF.
    /// @return requestId The VRF request identifier.
    function requestRandomness() external onlyRole(VRF_MANAGER_ROLE) returns (uint256 requestId) {
        requestId = vrfCoordinator.requestRandomWords(
            keyHash,
            subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        requestToSender[requestId] = msg.sender;
        emit RandomnessRequested(requestId, msg.sender);
    }

    /// @notice Called by the VRF Coordinator with the random result.
    /// @dev Override this in derived contracts to consume the randomness.
    /// @param requestId The VRF request identifier.
    /// @param randomWords Array of random values.
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal virtual {
        requestToResult[requestId] = randomWords;
        emit RandomnessFulfilled(requestId, randomWords);
    }

    /// @notice External entry point called by the VRF coordinator.
    /// @dev The coordinator calls this function after generating the random words.
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        require(msg.sender == address(vrfCoordinator), "VRFConsumer: only coordinator");
        fulfillRandomWords(requestId, randomWords);
    }

    /// @notice Updates the callback gas limit.
    function setCallbackGasLimit(uint32 gasLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        callbackGasLimit = gasLimit;
    }

    /// @notice Updates the number of words requested per call.
    function setNumWords(uint32 words) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(words > 0, "VRFConsumer: zero words");
        numWords = words;
    }

    /// @notice Updates the minimum confirmations.
    function setRequestConfirmations(uint16 confirmations) external onlyRole(DEFAULT_ADMIN_ROLE) {
        requestConfirmations = confirmations;
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
