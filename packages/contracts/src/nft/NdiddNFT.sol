// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title NdiddNFT
/// @notice Upgradeable ERC721 NFT collection with enumerable, URI storage, EIP-2981 royalties, and role-based access.
contract NdiddNFT is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    ERC2981Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public constant MAX_SUPPLY = 10_000;

    uint256 public mintPrice;
    uint256 private _nextTokenId;

    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event Withdrawn(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the NFT contract.
    /// @param defaultAdmin Address receiving all admin roles and royalty receiver.
    function initialize(address defaultAdmin) external initializer {
        __ERC721_init("Ndidd NFT", "NDIDD-NFT");
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __ERC2981_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, defaultAdmin);

        mintPrice = 0.08 ether;
        // 500 basis points = 5% royalty
        _setDefaultRoyalty(defaultAdmin, 500);
    }

    /// @notice Mints a single token to a recipient (role-gated).
    /// @param to Recipient address.
    /// @param uri Token metadata URI.
    function safeMint(address to, string memory uri) external onlyRole(MINTER_ROLE) {
        uint256 tokenId = _nextTokenId++;
        require(tokenId < MAX_SUPPLY, "NdiddNFT: max supply reached");
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    /// @notice Public mint function requiring ETH payment.
    /// @param quantity Number of tokens to mint.
    function publicMint(uint256 quantity) external payable whenNotPaused {
        require(quantity > 0, "NdiddNFT: zero quantity");
        require(_nextTokenId + quantity <= MAX_SUPPLY, "NdiddNFT: exceeds max supply");
        require(msg.value >= mintPrice * quantity, "NdiddNFT: insufficient payment");

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(msg.sender, tokenId);
        }
    }

    /// @notice Batch mints tokens to multiple recipients (role-gated).
    /// @param recipients Array of recipient addresses.
    /// @param uris Array of token metadata URIs.
    function batchMint(
        address[] calldata recipients,
        string[] calldata uris
    ) external onlyRole(MINTER_ROLE) {
        require(recipients.length == uris.length, "NdiddNFT: length mismatch");
        require(_nextTokenId + recipients.length <= MAX_SUPPLY, "NdiddNFT: exceeds max supply");

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, uris[i]);
        }
    }

    /// @notice Updates the public mint price.
    /// @param newPrice New price in wei.
    function setMintPrice(uint256 newPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit MintPriceUpdated(mintPrice, newPrice);
        mintPrice = newPrice;
    }

    /// @notice Updates the default royalty for all tokens.
    /// @param receiver Royalty receiver address.
    /// @param feeNumerator Fee in basis points (e.g., 500 = 5%).
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    /// @notice Sets per-token royalty override.
    /// @param tokenId Token to configure.
    /// @param receiver Royalty receiver.
    /// @param feeNumerator Fee in basis points.
    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 feeNumerator
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    /// @notice Withdraws all ETH to the admin.
    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "NdiddNFT: no balance");
        address payable to = payable(msg.sender);
        emit Withdrawn(to, balance);
        (bool ok, ) = to.call{value: balance}("");
        require(ok, "NdiddNFT: transfer failed");
    }

    /// @notice Pauses all token transfers and public minting.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses token transfers and public minting.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /// @dev Hook enforcing pause on transfers.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) whenNotPaused returns (address) {
        return super._update(to, tokenId, auth);
    }

    /// @dev Required override for ERC721Enumerable.
    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._increaseBalance(account, value);
    }

    /// @inheritdoc ERC721URIStorageUpgradeable
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /// @inheritdoc ERC165Upgradeable
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
