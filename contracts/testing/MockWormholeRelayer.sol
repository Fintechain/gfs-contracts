// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockWormholeRelayer
 * @notice Mock implementation of the Wormhole relayer contract for testing
 * @dev Simulates relayer functionality like message delivery and fee quoting
 */
contract MockWormholeRelayer {
    // Delivery price configuration
    struct DeliveryPrice {
        uint256 nativePriceQuote;
        uint256 targetChainRefundPerGasUnused;
    }
    
    mapping(uint16 => DeliveryPrice) private chainPrices;
    mapping(uint16 => bool) public supportedChains;

    event DeliveryPriceSet(
        uint16 chainId,
        uint256 nativePriceQuote,
        uint256 targetChainRefundPerGasUnused
    );

    /**
     * @notice Set the delivery price for a specific chain
     * @param chainId Target chain ID
     * @param nativePriceQuote Price quote in native tokens
     * @param refundPerGasUnused Refund rate per unused gas
     */
    function setDeliveryPrice(
        uint16 chainId,
        uint256 nativePriceQuote,
        uint256 refundPerGasUnused
    ) external {
        chainPrices[chainId] = DeliveryPrice({
            nativePriceQuote: nativePriceQuote,
            targetChainRefundPerGasUnused: refundPerGasUnused
        });
        supportedChains[chainId] = true;
        
        emit DeliveryPriceSet(chainId, nativePriceQuote, refundPerGasUnused);
    }

    /**
     * @notice Quote delivery price for EVM chain
     * @param targetChain Target chain ID
     * @param payloadSize Size of the payload
     * @param gasLimit Gas limit for execution
     * @return nativePriceQuote Price quote in native tokens
     * @return targetChainRefundPerGasUnused Refund rate per unused gas
     */
    function quoteEVMDeliveryPrice(
        uint16 targetChain,
        uint256 payloadSize,
        uint256 gasLimit
    ) external view returns (uint256 nativePriceQuote, uint256 targetChainRefundPerGasUnused) {
        require(supportedChains[targetChain], "MockWormholeRelayer: Chain not supported");
        
        DeliveryPrice memory price = chainPrices[targetChain];
        return (price.nativePriceQuote, price.targetChainRefundPerGasUnused);
    }

    /**
     * @notice Check if a chain is supported
     * @param chainId Chain ID to check
     * @return isSupported Whether chain is supported
     */
    function isChainSupported(uint16 chainId) external view returns (bool) {
        return supportedChains[chainId];
    }
}
