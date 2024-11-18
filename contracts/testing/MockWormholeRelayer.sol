// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockWormholeRelayer
 * @notice Mock implementation of the Wormhole relayer contract for testing
 * @dev Simulates relayer functionality like message delivery and fee quoting
 */
contract MockWormholeRelayer {
    // Fee calculation components
    uint256 private nativePriceQuote = 0.1 ether;
    uint256 private refundPerGasUnused = 0.00001 ether;
    uint256 private pricePerGas = 1 gwei;
    uint256 private pricePerByte = 100 wei;
    
    event DeliveryPriceSet(
        uint16 chainId,
        uint256 nativePriceQuote,
        uint256 targetChainRefundPerGasUnused
    );

    /**
     * @notice Set the delivery price components
     * @param chainId Target chain ID
     * @param _nativePriceQuote Base price quote in native tokens
     * @param _refundPerGasUnused Refund rate per unused gas
     */
    function setDeliveryPrice(
        uint16 chainId,
        uint256 _nativePriceQuote,
        uint256 _refundPerGasUnused
    ) external {
        nativePriceQuote = _nativePriceQuote;
        refundPerGasUnused = _refundPerGasUnused;
        emit DeliveryPriceSet(chainId, _nativePriceQuote, _refundPerGasUnused);
    }

    /**
     * @notice Set gas and byte pricing for more precise fee testing
     * @param _pricePerGas Price per gas unit
     * @param _pricePerByte Price per byte of payload
     */
    function setGasAndBytePrices(
        uint256 _pricePerGas,
        uint256 _pricePerByte
    ) external {
        pricePerGas = _pricePerGas;
        pricePerByte = _pricePerByte;
    }

    /**
     * @notice Quote delivery price for EVM chain
     * @param targetChain Target chain ID
     * @param payloadSize Size of the payload
     * @param gasLimit Gas limit for execution
     * @return deliveryCost Total delivery cost including gas and payload
     * @return targetChainRefundPerGasUnused Refund rate per unused gas
     */
    function quoteEVMDeliveryPrice(
        uint16 targetChain,
        uint256 payloadSize,
        uint256 gasLimit
    ) external view returns (uint256 deliveryCost, uint256 targetChainRefundPerGasUnused) {
        // Calculate total delivery cost based on all components
        deliveryCost = nativePriceQuote + 
                      (gasLimit * pricePerGas) + 
                      (payloadSize * pricePerByte);
        
        return (deliveryCost, refundPerGasUnused);
    }

    /**
     * @notice Check if a chain is supported
     * @param chainId Chain ID to check
     * @return isSupported Whether chain is supported
     */
    function isChainSupported(uint16 chainId) external pure returns (bool) {
        // Always return true for testing
        return true;
    }
}