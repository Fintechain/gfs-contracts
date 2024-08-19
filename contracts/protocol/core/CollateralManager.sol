// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/ICollateralManager.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract CollateralManager is Initializable, ICollateralManager, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    struct Collateral {
        uint256 amount;
        uint256 valueInBaseCurrency;
    }

    mapping(address => mapping(bytes32 => Collateral)) private collaterals;
    mapping(bytes32 => address) private assetAddresses;

    event CollateralDeposited(address indexed owner, bytes32 indexed assetType, uint256 amount);
    event CollateralWithdrawn(address indexed owner, bytes32 indexed assetType, uint256 amount);
    event CollateralValueUpdated(address indexed owner, bytes32 indexed assetType, uint256 newValue);
    event AssetTypeAdded(bytes32 indexed assetType, address assetAddress);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPDATER_ROLE, admin);
    }

    function addAssetType(bytes32 assetType, address assetAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(assetAddresses[assetType] == address(0), "Asset type already exists");
        assetAddresses[assetType] = assetAddress;
        emit AssetTypeAdded(assetType, assetAddress);
    }

    function depositCollateral(bytes32 assetType, uint256 amount) external override nonReentrant {
        require(assetAddresses[assetType] != address(0), "Invalid asset type");
        require(amount > 0, "Amount must be greater than 0");

        IERC20Upgradeable token = IERC20Upgradeable(assetAddresses[assetType]);
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 actualAmount = balanceAfter - balanceBefore;

        collaterals[msg.sender][assetType].amount += actualAmount;

        emit CollateralDeposited(msg.sender, assetType, actualAmount);
    }

    function withdrawCollateral(bytes32 assetType, uint256 amount) external override nonReentrant {
        require(assetAddresses[assetType] != address(0), "Invalid asset type");
        require(amount > 0, "Amount must be greater than 0");
        require(collaterals[msg.sender][assetType].amount >= amount, "Insufficient collateral");

        collaterals[msg.sender][assetType].amount -= amount;

        IERC20Upgradeable token = IERC20Upgradeable(assetAddresses[assetType]);
        token.safeTransfer(msg.sender, amount);

        emit CollateralWithdrawn(msg.sender, assetType, amount);
    }

    function updateCollateralValue(
        address owner, 
        bytes32 assetType, 
        uint256 newValue
    ) 
        external 
        override 
        onlyRole(UPDATER_ROLE) 
    {
        require(assetAddresses[assetType] != address(0), "Invalid asset type");
        collaterals[owner][assetType].valueInBaseCurrency = newValue;
        emit CollateralValueUpdated(owner, assetType, newValue);
    }

    function getCollateralValue(address owner, bytes32 assetType) external view override returns (uint256) {
        return collaterals[owner][assetType].valueInBaseCurrency;
    }

    function getCollateralAmount(address owner, bytes32 assetType) external view returns (uint256) {
        return collaterals[owner][assetType].amount;
    }

    function getAssetAddress(bytes32 assetType) external view returns (address) {
        return assetAddresses[assetType];
    }
}
