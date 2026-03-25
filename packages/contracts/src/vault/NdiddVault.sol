// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Minimal interface for an external yield strategy.
interface IStrategy {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function harvest() external returns (uint256 harvestedAmount);
    function totalAssets() external view returns (uint256);
}

/// @title NdiddVault
/// @notice Upgradeable ERC-4626 yield vault with pluggable strategy, fees, and reentrancy protection.
contract NdiddVault is
    Initializable,
    ERC4626Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // ── Reentrancy guard (EIP-1967 storage slot pattern for upgradeability) ───
    // keccak256("ndidd.vault.reentrancy") - 1
    bytes32 private constant REENTRANCY_SLOT = 0xdc4bf5df2e3c94714de9d3e29e3fdf58cd9f9de3a4bdf1e0b5e05e7bfb6d5a1e;
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    modifier nonReentrant() {
        assembly {
            if eq(sload(REENTRANCY_SLOT), ENTERED) {
                revert(0, 0)
            }
            sstore(REENTRANCY_SLOT, ENTERED)
        }
        _;
        assembly {
            sstore(REENTRANCY_SLOT, NOT_ENTERED)
        }
    }
    using SafeERC20 for IERC20;

    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant MAX_FEE = 2_000; // 20% hard cap

    /// @notice Maximum deposit allowed per block per address (0 = unlimited).
    mapping(address => uint256) public depositedThisBlock;
    mapping(address => uint256) public lastDepositBlock;
    uint256 public maxDepositPerBlock;

    IStrategy public strategy;
    uint256 public performanceFee; // basis points
    uint256 public managementFee; // basis points per year
    uint256 public lastHarvest;

    address public feeRecipient;

    event Deposited(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdrawn(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event Harvested(uint256 profit, uint256 feeCollected);
    event StrategyUpdated(address indexed oldStrategy, address indexed newStrategy);
    event FeesCollected(address indexed recipient, uint256 amount);
    event FeesUpdated(uint256 performanceFee, uint256 managementFee);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the vault.
    /// @param asset_ Underlying ERC20 asset.
    /// @param strategy_ Initial strategy address.
    /// @param admin Initial admin address.
    function initialize(IERC20 asset_, address strategy_, address admin) external initializer {
        __ERC4626_init(asset_);
        __ERC20_init("Ndidd Vault", "ndVLT");
        __AccessControl_init();
        __Pausable_init();

        // Initialize reentrancy guard
        assembly {
            sstore(REENTRANCY_SLOT, NOT_ENTERED)
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(STRATEGIST_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        strategy = IStrategy(strategy_);
        feeRecipient = admin;
        performanceFee = 1_000; // 10%
        managementFee = 200; // 2% per year
        lastHarvest = block.timestamp;
        maxDepositPerBlock = 0; // unlimited by default
    }

    /// @inheritdoc ERC4626Upgradeable
    /// @dev Adds reentrancy guard, pause check, and per-block rate limiting.
    function deposit(uint256 assets, address receiver) public override nonReentrant whenNotPaused returns (uint256) {
        _checkDepositLimit(msg.sender, assets);
        uint256 shares = super.deposit(assets, receiver);
        emit Deposited(msg.sender, receiver, assets, shares);
        return shares;
    }

    /// @inheritdoc ERC4626Upgradeable
    /// @dev Adds reentrancy guard and pause check.
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override nonReentrant whenNotPaused returns (uint256) {
        uint256 shares = super.withdraw(assets, receiver, owner);
        emit Withdrawn(msg.sender, receiver, owner, assets, shares);
        return shares;
    }

    /// @inheritdoc ERC4626Upgradeable
    function mint(uint256 shares, address receiver) public override nonReentrant whenNotPaused returns (uint256) {
        uint256 assets = previewMint(shares);
        _checkDepositLimit(msg.sender, assets);
        return super.mint(shares, receiver);
    }

    /// @inheritdoc ERC4626Upgradeable
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override nonReentrant whenNotPaused returns (uint256) {
        return super.redeem(shares, receiver, owner);
    }

    /// @notice Triggers strategy harvest and collects performance fees.
    function harvest() external nonReentrant onlyRole(STRATEGIST_ROLE) {
        require(address(strategy) != address(0), "NdiddVault: no strategy");

        uint256 before = strategy.totalAssets();
        uint256 harvested = strategy.harvest();
        uint256 after_ = strategy.totalAssets();

        uint256 profit = after_ > before ? after_ - before : 0;
        if (profit == 0 && harvested == 0) {
            lastHarvest = block.timestamp;
            return;
        }

        // Collect management fee based on time elapsed
        uint256 elapsed = block.timestamp - lastHarvest;
        uint256 totalAum = totalAssets();
        uint256 mgmtFeeAmount = (totalAum * managementFee * elapsed) / (MAX_BPS * 365 days);

        // Collect performance fee on profit
        uint256 perfFeeAmount = (profit * performanceFee) / MAX_BPS;

        uint256 totalFee = mgmtFeeAmount + perfFeeAmount;
        lastHarvest = block.timestamp;

        if (totalFee > 0 && feeRecipient != address(0)) {
            IERC20(asset()).safeTransfer(feeRecipient, totalFee);
            emit FeesCollected(feeRecipient, totalFee);
        }

        emit Harvested(profit, totalFee);
    }

    /// @notice Replaces the active yield strategy.
    /// @param newStrategy Address of the new IStrategy implementation.
    function setStrategy(address newStrategy) external onlyRole(STRATEGIST_ROLE) {
        require(newStrategy != address(0), "NdiddVault: zero address");
        address old = address(strategy);
        strategy = IStrategy(newStrategy);
        emit StrategyUpdated(old, newStrategy);
    }

    /// @notice Updates protocol fee parameters.
    /// @param perfFee New performance fee in basis points.
    /// @param mgmtFee New management fee in basis points per year.
    function setFees(uint256 perfFee, uint256 mgmtFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(perfFee <= MAX_FEE && mgmtFee <= MAX_FEE, "NdiddVault: fee too high");
        performanceFee = perfFee;
        managementFee = mgmtFee;
        emit FeesUpdated(perfFee, mgmtFee);
    }

    /// @notice Updates the fee recipient address.
    function setFeeRecipient(address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(recipient != address(0), "NdiddVault: zero address");
        feeRecipient = recipient;
    }

    /// @notice Sets the per-block deposit cap per address. 0 disables the cap.
    function setMaxDepositPerBlock(uint256 cap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxDepositPerBlock = cap;
    }

    /// @notice Pauses vault operations.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses vault operations.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @inheritdoc ERC4626Upgradeable
    function totalAssets() public view override returns (uint256) {
        uint256 strategyAssets = address(strategy) != address(0) ? strategy.totalAssets() : 0;
        return IERC20(asset()).balanceOf(address(this)) + strategyAssets;
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /// @dev Enforces per-block deposit rate limiting.
    function _checkDepositLimit(address depositor, uint256 assets) internal {
        if (maxDepositPerBlock == 0) return;
        if (lastDepositBlock[depositor] != block.number) {
            depositedThisBlock[depositor] = 0;
            lastDepositBlock[depositor] = block.number;
        }
        depositedThisBlock[depositor] += assets;
        require(depositedThisBlock[depositor] <= maxDepositPerBlock, "NdiddVault: deposit rate limit exceeded");
    }
}
