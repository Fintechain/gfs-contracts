import { ConfigNames } from "./utils/config-helpers";

export const MARKET_NAME =
  (process.env.MARKET_NAME as ConfigNames) || ConfigNames.Commons;

export const ENABLE_REWARDS = process.env.ENABLE_REWARDS
  ? process.env.ENABLE_REWARDS === "true"
  : undefined;

export const DETERMINISTIC_DEPLOYMENT = process.env.DETERMINISTIC_DEPLOYMENT
  ? process.env.DETERMINISTIC_DEPLOYMENT === "true"
  : null;

export const COMMON_DEPLOY_PARAMS = {
  log: false,
  waitConfirmations: 1,
  deterministicDeployment: DETERMINISTIC_DEPLOYMENT ?? false,
};

export const PERMISSIONED_FAUCET =
  process.env.PERMISSIONED_FAUCET === "true" || false;