import { iParamsPerNetwork, eNetwork, tEthereumAddress, ProtocolConfiguration, ICommonConfiguration } from "../types";
import { isValidAddress } from "./utils";
import EthereumV1Market from "../config/ethereum";
import EthereumV1TestnetMarket from "../config/test";
import { HardhatRuntimeEnvironment } from "hardhat/types";

declare var hre: HardhatRuntimeEnvironment;

export enum ConfigNames {
    Commons = "Commons",
    Test = "Test",
    Harmony = "Harmony",
    Avalanche = "Avalanche",
    Fantom = "Fantom",
    Polygon = "Polygon",
    Optimistic = "Optimistic",
    Arbitrum = "Arbitrum",
    Ethereum = "Ethereum",
    Base = "Base",
    baseGoerli = "base-goerli",
}

export const getParamPerNetwork = <T>(
    param: iParamsPerNetwork<T> | undefined,
    network: eNetwork
): T | undefined => {
    if (!param) return undefined;

    return param[network];
};

export const getAddressFromConfig = (
    param: iParamsPerNetwork<string | undefined>,
    network: eNetwork,
    key?: string
): tEthereumAddress => {
    const value = getParamPerNetwork<tEthereumAddress | undefined>(
        param,
        network
    );
    if (!value || !isValidAddress(value)) {
        throw Error(
            `[aave-v3-deploy] Input parameter ${key ? `"${key}"` : ""
            } is missing or is not an address.`
        );
    }
    return value;
};

export const isProductionMarket = (
    protocolConfig: ICommonConfiguration
): boolean => {
    const network = (
        process.env.FORK ? process.env.FORK : hre.network.name
    ) as eNetwork;

    return hre.config.networks[network]?.live && !protocolConfig.TestnetMarket;
};

export const isTestnetMarket = (protocolConfig: ICommonConfiguration): boolean =>
    !isProductionMarket(protocolConfig);

export const loadProtocolConfig = (configName: ConfigNames): ProtocolConfiguration => {
    switch (configName) {
        case ConfigNames.Test:
            return EthereumV1TestnetMarket;
        case ConfigNames.Ethereum:
            return EthereumV1Market;
        default:
            throw new Error(
                `Unsupported protocol configuration: ${configName} is not one of the supported configs ${Object.values(
                    ConfigNames
                )}`
            );
    }
};
