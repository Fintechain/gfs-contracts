import { ZERO_ADDRESS } from "../../constants";
import { eEthereumNetwork, ICommonConfiguration } from "../../types";

export const CommonsConfig: ICommonConfiguration = {
    MarketId: "Commons GFS Configuration",
    SymbolPrefix: "Eth",
    GFSTokenNamePrefix: "",
    ProviderId: 8080,
    WormHoleCoreContracts: {
        [eEthereumNetwork.main]: ZERO_ADDRESS,
        [eEthereumNetwork.sepolia]: ZERO_ADDRESS,
    },
    WormHoleRelayContracts: {
        [eEthereumNetwork.main]: ZERO_ADDRESS,
        [eEthereumNetwork.sepolia]: ZERO_ADDRESS,
    },
    ReserveAssets: {},
};
