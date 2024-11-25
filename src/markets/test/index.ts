import { eEthereumNetwork, ICommonConfiguration } from "../../types";
import { CommonsConfig } from "./common";

export const EthereumV1TestnetMarket: ICommonConfiguration = {
    ...CommonsConfig,
    MarketId: "GFS Ethereum Testnet Configuration",
    WormHoleCoreContracts: {
        [eEthereumNetwork.holesky]: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
        [eEthereumNetwork.sepolia]: "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78",
    },
    WormHoleRelayContracts: {
        [eEthereumNetwork.holesky]: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
        [eEthereumNetwork.sepolia]: "0x7B1bD7a6b4E61c2a123AC6BC2cbfC614437D0470",
    },
};

export default EthereumV1TestnetMarket;