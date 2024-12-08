import { iParamsPerNetwork, SymbolMap, tEthereumAddress } from "./base";

export interface IBaseConfiguration {
    MarketId: string;
    GFSTokenNamePrefix: string;
    SymbolPrefix: string;
    ProviderId: number;
    TestnetMarket?: boolean;
    ReserveAssets?: iParamsPerNetwork<SymbolMap<tEthereumAddress>>;
    WormHoleCoreContracts?: iParamsPerNetwork<tEthereumAddress>;
    WormHoleRelayContracts?: iParamsPerNetwork<tEthereumAddress>;
}

export interface ICommonConfiguration extends IBaseConfiguration {}

export interface IGFSConfiguration extends ICommonConfiguration {
}

export type ProtocolConfiguration = ICommonConfiguration;