import { logger } from "../utils/logger";

const meta = import.meta as ImportMeta & {
  env?: Record<string, string | boolean | undefined>;
};

const CONTROL_API_URL =
  typeof meta.env?.VITE_OCLUSHION_CONTROL_API_URL === "string"
    ? meta.env.VITE_OCLUSHION_CONTROL_API_URL
    : "";

export function getControlApiUrl(): string {
  if (!CONTROL_API_URL) {
    if (typeof meta.env !== "undefined" && meta.env?.MODE === "production") {
      logger.error("Config", "VITE_OCLUSHION_CONTROL_API_URL not configured");
    }
  }
  return CONTROL_API_URL.replace(/\/$/u, "");
}
