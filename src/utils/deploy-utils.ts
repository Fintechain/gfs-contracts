/**
 * Utility functions to manage and verify deployment modes in a Hardhat project.
 * 
 * Deployment modes determine which contracts are deployed and tested, 
 * allowing separation of logic between `unit`, `integration`, and `production` environments.
 * 
 * Usage:
 * - Set the `DEPLOY_MODE` environment variable to `unit`, `integration`, or `production`.
 * - Use these utilities to verify the mode or fetch the active deployment mode.
 */

import { BaseContract, Contract } from "ethers";
import { string } from "hardhat/internal/core/params/argumentTypes";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ContractNameToVariant, ContractVariant, IContractEnvironment } from "../types/deployment";

export type DeploymentMode = "unit" | "integration" | "production";

/**
 * Valid deployment modes.
 */
const VALID_DEPLOYMENT_MODES: DeploymentMode[] = ["unit", "integration", "production"];

/**
 * Retrieves the current deployment mode from the environment variable.
 * Defaults to "unit" if not explicitly set.
 *
 * @returns {DeploymentMode} The active deployment mode.
 * @throws {Error} If the deployment mode is invalid or not supported.
 */
export function getDeploymentMode(): DeploymentMode {
    const deployMode = process.env.DEPLOY_MODE as DeploymentMode | undefined;

    if (!deployMode) {
        console.warn("DEPLOY_MODE not set. Defaulting to 'unit'.");
        return "unit";
    }

    if (!VALID_DEPLOYMENT_MODES.includes(deployMode)) {
        throw new Error(
            `Invalid DEPLOY_MODE: "${deployMode}". Valid options are ${VALID_DEPLOYMENT_MODES.join(", ")}.`
        );
    }

    return deployMode;
}

/**
 * Verifies if the current deployment mode matches the specified mode.
 *
 * @param {DeploymentMode} mode - The mode to verify against.
 * @returns {boolean} True if the current mode matches the specified mode, otherwise false.
 */
export function isDeploymentMode(mode: DeploymentMode): boolean {
    return getDeploymentMode() === mode;
}

/**
 * Utility to check if the current deployment mode is "unit".
 *
 * @returns {boolean} True if the deployment mode is "unit".
 */
export function isUnitMode(): boolean {
    return isDeploymentMode("unit");
}

/**
 * Utility to check if the current deployment mode is "integration".
 *
 * @returns {boolean} True if the deployment mode is "integration".
 */
export function isIntegrationMode(): boolean {
    return isDeploymentMode("integration");
}

/**
 * Utility to check if the current deployment mode is "production".
 *
 * @returns {boolean} True if the deployment mode is "production".
 */
export function isProductionMode(): boolean {
    return isDeploymentMode("production");
}

/**
 * Logs the current deployment mode to the console for debugging purposes.
 */
export function logDeploymentMode(): void {
    console.info(`Current deployment mode: ${getDeploymentMode()}`);
}

/**
 * 
 * @param name 
 * @param hre 
 * @returns 
 */
export async function getDeployedContract(name: string, hre: HardhatRuntimeEnvironment): Promise<BaseContract> {
    const { deployments } = hre;
    const { get } = deployments;

    const contractDeployment = (await get(name));
    const contract = await hre.ethers.getContractAt(name, contractDeployment.address);
    return contract
}

/**
 * Retrieves a deployed contract instance with proper typing.
 * @template T - The contract type from typechain
 */
export async function getContractVariantInstance<T extends BaseContract>(
    variant: ContractNameToVariant<string>,
    hre: HardhatRuntimeEnvironment
): Promise<T> {
    const { deployments, ethers } = hre;
    const contractName = isUnitMode() ? variant.mock : variant.real;
    
    const deployment = await deployments.get(contractName);
    const contract = await ethers.getContractAt(contractName, deployment.address);
    
    return contract as unknown as T;
}

