// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @notice Minimal Chainlink AggregatorV3 interface.
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/// @title PriceFeedConsumer
/// @notice Upgradeable Chainlink price feed registry with staleness protection.
contract PriceFeedConsumer is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant FEED_MANAGER_ROLE = keccak256("FEED_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @notice Maximum acceptable age of a price answer.
    uint256 public constant STALENESS_THRESHOLD = 3600; // 1 hour

    /// @notice Maps keccak256(symbol) to Chainlink feed address.
    mapping(bytes32 => address) public priceFeeds;

    event PriceFeedSet(bytes32 indexed symbolHash, string symbol, address indexed feed);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the price feed consumer.
    /// @param admin Address receiving all admin roles.
    function initialize(address admin) external initializer {
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FEED_MANAGER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    /// @notice Retrieves the latest price for a symbol.
    /// @param symbol Human-readable ticker symbol (e.g., "ETH/USD").
    /// @return price Latest answer from the feed.
    /// @return updatedAt Timestamp of the latest answer.
    function getLatestPrice(string memory symbol) external view returns (int256 price, uint256 updatedAt) {
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        address feed = priceFeeds[symbolHash];
        require(feed != address(0), "PriceFeedConsumer: unknown symbol");
        return _getPrice(feed);
    }

    /// @notice Retrieves the latest price from a specific feed address.
    /// @param feed Chainlink aggregator address.
    /// @return price Latest answer.
    /// @return updatedAt Timestamp of the answer.
    function getPriceFromFeed(address feed) external view returns (int256 price, uint256 updatedAt) {
        require(feed != address(0), "PriceFeedConsumer: zero address");
        return _getPrice(feed);
    }

    /// @notice Registers or updates a price feed for a symbol.
    /// @param symbol Human-readable ticker symbol.
    /// @param feed Chainlink aggregator address.
    function setPriceFeed(string calldata symbol, address feed) external onlyRole(FEED_MANAGER_ROLE) {
        require(feed != address(0), "PriceFeedConsumer: zero address");
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        priceFeeds[symbolHash] = feed;
        emit PriceFeedSet(symbolHash, symbol, feed);
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /// @dev Fetches and validates a price from an aggregator.
    function _getPrice(address feed) internal view returns (int256 price, uint256 updatedAt) {
        (, int256 answer, , uint256 timestamp, ) = AggregatorV3Interface(feed).latestRoundData();
        require(answer > 0, "PriceFeedConsumer: non-positive price");
        require(
            block.timestamp - timestamp <= STALENESS_THRESHOLD,
            "PriceFeedConsumer: stale price"
        );
        return (answer, timestamp);
    }
}
