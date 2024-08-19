// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "../../interfaces/IAccountManager.sol";

contract AccountManager is Initializable, IAccountManager, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    //using SafeMathUpgradeable for uint256;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct Account {
        uint256 balance;
        uint256 reservedLiquidity;
        bool active;
    }

    mapping(address => mapping(bytes32 => Account)) private accounts;

    event AccountCreated(address indexed owner, bytes32 indexed currency);
    event BalanceUpdated(address indexed owner, bytes32 indexed currency, uint256 newBalance);
    event LiquidityReserved(address indexed owner, bytes32 indexed currency, uint256 amount);
    event LiquidityReleased(address indexed owner, bytes32 indexed currency, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    modifier onlyManager() {
        require(hasRole(MANAGER_ROLE, msg.sender), "Caller is not a manager");
        _;
    }

    modifier accountExists(address owner, bytes32 currency) {
        require(accounts[owner][currency].active, "Account does not exist");
        _;
    }

    function createAccount(bytes32 currency) external override {
        require(!accounts[msg.sender][currency].active, "Account already exists");

        accounts[msg.sender][currency] = Account({
            balance: 0,
            reservedLiquidity: 0,
            active: true
        });

        emit AccountCreated(msg.sender, currency);
    }

    function getBalance(address owner, bytes32 currency) 
        external 
        view 
        override 
        accountExists(owner, currency) 
        returns (uint256) 
    {
        return accounts[owner][currency].balance;
    }

    function updateBalance(
        address owner, 
        bytes32 currency, 
        uint256 amount, 
        bool isCredit
    ) 
        external 
        override 
        onlyManager 
        nonReentrant 
        accountExists(owner, currency) 
    {
        Account storage account = accounts[owner][currency];

        if (isCredit) {
            account.balance = account.balance.add(amount);
        } else {
            require(account.balance >= amount, "Insufficient balance");
            account.balance = account.balance.sub(amount);
        }

        emit BalanceUpdated(owner, currency, account.balance);
    }

    function reserveLiquidity(
        address owner, 
        bytes32 currency, 
        uint256 amount
    ) 
        external 
        override 
        onlyManager 
        nonReentrant 
        accountExists(owner, currency) 
    {
        Account storage account = accounts[owner][currency];

        uint256 availableLiquidity = account.balance.sub(account.reservedLiquidity);
        require(availableLiquidity >= amount, "Insufficient available liquidity");

        account.reservedLiquidity = account.reservedLiquidity.add(amount);

        emit LiquidityReserved(owner, currency, amount);
    }

    function releaseLiquidity(
        address owner, 
        bytes32 currency, 
        uint256 amount
    ) 
        external 
        override 
        onlyManager 
        nonReentrant 
        accountExists(owner, currency) 
    {
        Account storage account = accounts[owner][currency];

        require(account.reservedLiquidity >= amount, "Insufficient reserved liquidity");

        account.reservedLiquidity = account.reservedLiquidity.sub(amount);

        emit LiquidityReleased(owner, currency, amount);
    }

    function getAvailableLiquidity(address owner, bytes32 currency) 
        external 
        view 
        override 
        accountExists(owner, currency) 
        returns (uint256) 
    {
        Account storage account = accounts[owner][currency];
        return account.balance.sub(account.reservedLiquidity);
    }
}
