// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title NdiddToken
/// @notice Upgradeable ERC20 governance token with voting, permit, burn, and role-based access control.
contract NdiddToken is
    Initializable,
    ERC20Upgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    ERC20BurnableUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000e18;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the token contract.
    /// @param defaultAdmin Address that receives all admin roles.
    function initialize(address defaultAdmin) external initializer {
        __ERC20_init("Ndidd Token", "NDIDD");
        __ERC20Permit_init("Ndidd Token");
        __ERC20Votes_init();
        __ERC20Burnable_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, defaultAdmin);
    }

    /// @notice Mints new tokens, capped at MAX_SUPPLY.
    /// @param to Recipient address.
    /// @param amount Amount of tokens to mint.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "NdiddToken: max supply exceeded");
        _mint(to, amount);
    }

    /// @notice Pauses all token transfers.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses token transfers.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Delegates voting power for multiple accounts in a single transaction via EIP-712 sigs.
    /// @dev Each entry mirrors the `delegateBySig` parameters. Reverts on any invalid signature.
    struct DelegateSig {
        address delegatee;
        uint256 nonce;
        uint256 expiry;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function delegateBatch(DelegateSig[] calldata sigs) external {
        for (uint256 i = 0; i < sigs.length; i++) {
            DelegateSig calldata d = sigs[i];
            delegateBySig(d.delegatee, d.nonce, d.expiry, d.v, d.r, d.s);
        }
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /// @dev Overrides _update to combine ERC20Votes and ERC20 logic and enforce pause.
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) whenNotPaused {
        super._update(from, to, value);
    }

    /// @dev Overrides nonces() to resolve conflict between ERC20Permit and ERC20Votes (OZ v5).
    function nonces(address owner) public view override(ERC20PermitUpgradeable, NoncesUpgradeable) returns (uint256) {
        return super.nonces(owner);
    }
}
