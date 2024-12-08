export type tEthereumAddress = string;
export type tStringTokenBigUnits = string; // 1 ETH, or 10e6 USDC or 10e18 DAI
export type tBigNumberTokenBigUnits = BigInt;
export type tStringTokenSmallUnits = string; // 1 wei, or 1 basic unit of USDC, or 1 basic unit of DAI
export type tBigNumberTokenSmallUnits = BigInt;

export interface ITokenAddress {
    [token: string]: tEthereumAddress;
}

export type eNetwork =
    | eEthereumNetwork
    | ePolygonNetwork
    | eAvalancheNetwork
    | eArbitrumNetwork
    | eHarmonyNetwork
    | eOptimismNetwork
    | eBaseNetwork;


export enum eAvalancheNetwork {
    avalanche = "avalanche",
    fuji = "fuji",
}

export enum eArbitrumNetwork {
    arbitrum = "arbitrum",
    arbitrumTestnet = "arbitrum-testnet",
    goerliNitro = "arbitrum-goerli",
}

export enum eOptimismNetwork {
    main = "optimism",
    testnet = "optimism-testnet",
}

export enum eEthereumNetwork {
    buidlerevm = "buidlerevm",
    main = "main",
    coverage = "coverage",
    hardhat = "hardhat",
    sepolia = "sepolia",
    holesky = "holesky"
}

export enum eBaseNetwork {
    base = "base",
    baseGoerli = "base-goerli",
}

export enum ePolygonNetwork {
    polygon = "polygon",
    mumbai = "mumbai",
}

export enum eHarmonyNetwork {
    main = "harmony",
    testnet = "harmony-testnet",
}

export interface SymbolMap<T> {
    [symbol: string]: T;
}

export type iParamsPerNetwork<T> = {
    [k in eNetwork]?: T;
};


export enum ContractID {
    Example = "Example",
    PoolAddressesProvider = "PoolAddressesProvider",
    MintableERC20 = "MintableERC20",
}
