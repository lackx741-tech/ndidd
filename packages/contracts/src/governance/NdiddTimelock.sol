// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title NdiddTimelock
/// @notice Upgradeable TimelockController for DAO governance with a minimum delay.
contract NdiddTimelock is Initializable, TimelockControllerUpgradeable, UUPSUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the timelock.
    /// @param admin Address receiving the timelock admin role (and UPGRADER for UUPS).
    /// @param proposers Initial list of proposer addresses.
    /// @param executors Initial list of executor addresses (address(0) = open execution).
    function initialize(
        address admin,
        address[] memory proposers,
        address[] memory executors
    ) external initializer {
        __TimelockController_init(2 days, proposers, executors, admin);
    }

    /// @inheritdoc UUPSUpgradeable
    /// @dev Only the timelock admin can authorize upgrades.
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
