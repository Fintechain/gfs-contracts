import { ethers, parseEther, parseUnits } from "ethers";

export const PERCENTAGE_FACTOR = "10000";
export const HALF_PERCENTAGE = "5000";
export const oneEther = parseEther("1");
export const oneRay = parseUnits("1", 27);
export const MAX_UINT_AMOUNT =
    "115792089237316195423570985008687907853269984665640564039457584007913129639935";
export const ZERO_ADDRESS = ethers.ZeroAddress;
export const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
export const ZERO_BYTES_32 =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

export const DEFAULT_NAMED_ACCOUNTS = {
    deployer: {
        default: 0,
    },
    admin: {
        default: 0,
    },
};


