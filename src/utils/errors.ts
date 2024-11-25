

/*
 * Error messages prefix glossary:
 *  - VL = ValidationLogic
 *  - MATH = Math libraries
 *  - PC = ProtocolCoordinator
 *  - PG = ProtocolGovernance
 *  - MP = MessageProtocol
 *  - MR = MessageRegistry
 *  - MRTR = MessageRouter
 *  - MPROC = MessageProcessor
 *  - SC = SettlementController
 *  - LP = LiquidityPool
 *  - TR = TargetRegistry
 */
export enum ProtocolErrors {
    //common errors
    CALLER_NOT_POOL_ADMIN = "33", // 'The caller must be the pool admin'

    //contract specific errors
    VL_INVALID_AMOUNT = "1", // 'Amount must be greater than 0'
    LP_NOT_ENOUGH_STABLE_BORROW_BALANCE = "21", // 'User does not have any stable rate loan for this reserve'
    CT_CALLER_MUST_BE_LENDING_POOL = "29", // 'The caller of this function must be a lending pool'
    RL_RESERVE_ALREADY_INITIALIZED = "32", // 'Reserve has already been initialized'
    LPC_RESERVE_LIQUIDITY_NOT_0 = "34", // 'The liquidity of the reserve needs to be 0'
    MATH_MULTIPLICATION_OVERFLOW = "48",
    MATH_ADDITION_OVERFLOW = "49",
    MATH_DIVISION_BY_ZERO = "50",
    RL_LIQUIDITY_INDEX_OVERFLOW = "51", //  Liquidity index overflows uint128
    // old

    INVALID_HF = "Invalid health factor",
    INVALID_FROM_BALANCE_AFTER_TRANSFER = "Invalid from balance after transfer",
    INVALID_TO_BALANCE_AFTER_TRANSFER = "Invalid from balance after transfer",
    INVALID_OWNER_REVERT_MSG = "Ownable: caller is not the owner",
    TRANSFER_AMOUNT_EXCEEDS_BALANCE = "ERC20: transfer amount exceeds balance",
    SAFEERC20_LOWLEVEL_CALL = "SafeERC20: low-level call failed",
}