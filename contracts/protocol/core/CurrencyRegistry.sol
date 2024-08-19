// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/ICurrencyRegistry.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

contract CurrencyRegistry is Initializable, AccessControlUpgradeable, PausableUpgradeable, ICurrencyRegistry {
    bytes32 public constant CURRENCY_ADMIN_ROLE = keccak256("CURRENCY_ADMIN_ROLE");

    mapping(bytes32 => Currency) private _currencies;
    bytes32[] private _currencyCodes;

    event CurrencyAdded(bytes32 indexed currencyCode, string name, uint8 decimals);
    event CurrencyStatusUpdated(bytes32 indexed currencyCode, bool active);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CURRENCY_ADMIN_ROLE, admin);
    }

    modifier currencyExists(bytes32 currencyCode) {
        require(_currencies[currencyCode].decimals != 0, "Currency does not exist");
        _;
    }

    function addCurrency(bytes32 currencyCode, string memory name, uint8 decimals) external override onlyRole(CURRENCY_ADMIN_ROLE) whenNotPaused {
        require(currencyCode != bytes32(0), "Invalid currency code");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(decimals > 0 && decimals <= 18, "Invalid decimals");
        require(_currencies[currencyCode].decimals == 0, "Currency already exists");

        _currencies[currencyCode] = Currency({
            name: name,
            decimals: decimals,
            active: true
        });

        _currencyCodes.push(currencyCode);

        emit CurrencyAdded(currencyCode, name, decimals);
    }

    function updateCurrencyStatus(bytes32 currencyCode, bool active) external override onlyRole(CURRENCY_ADMIN_ROLE) whenNotPaused currencyExists(currencyCode) {
        Currency storage currency = _currencies[currencyCode];
        require(currency.active != active, "Status already set");

        currency.active = active;

        emit CurrencyStatusUpdated(currencyCode, active);
    }

    function getCurrency(bytes32 currencyCode) external view override currencyExists(currencyCode) returns (Currency memory) {
        return _currencies[currencyCode];
    }

    function getCurrencyCount() external view override returns (uint256) {
        return _currencyCodes.length;
    }

    function getAllCurrencies() external view returns (bytes32[] memory, Currency[] memory) {
        Currency[] memory currencyDetails = new Currency[](_currencyCodes.length);
        for (uint i = 0; i < _currencyCodes.length; i++) {
            currencyDetails[i] = _currencies[_currencyCodes[i]];
        }
        return (_currencyCodes, currencyDetails);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}