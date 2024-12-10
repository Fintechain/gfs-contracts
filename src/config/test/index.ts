import { CommonsConfig } from "./common";
import { TX_CONFIGS } from "./transaction";
import { eEthereumNetwork, ProtocolConfiguration } from "../../types";

export const EthereumV1TestnetMarket: ProtocolConfiguration = {
    ...CommonsConfig,
    MarketId: "GFS Ethereum Testnet Configuration",
    WormHoleCoreContracts: {
        [eEthereumNetwork.main]: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
        [eEthereumNetwork.sepolia]: "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78",
        [eEthereumNetwork.holesky]: "0xa10f2eF61dE1f19f586ab8B6F2EbA89bACE63F7a",
    },
    WormHoleRelayContracts: {
        [eEthereumNetwork.main]: "0x27428DD2d3DD32A4D7f7C497eAaa23130d894911",
        [eEthereumNetwork.sepolia]: "0x7B1bD7a6b4E61c2a123AC6BC2cbfC614437D0470",
        [eEthereumNetwork.holesky]: "0x28D8F1Be96f97C1387e94A53e00eCcFb4E75175a",
    },
    TransactionConfig: TX_CONFIGS
};

export default EthereumV1TestnetMarket;