import defaultRaw from "../default.json";
import { loadParams, loadParamsWithOverlay, RawParamsSchema } from "./schema.js";
import type { Params, RawParams } from "./schema.js";

export { RawParamsSchema, loadParams, loadParamsWithOverlay };
export type { Params, RawParams };

export const DEFAULT_RAW_PARAMS: RawParams = RawParamsSchema.parse(defaultRaw);
export const DEFAULT_PARAMS: Params = loadParams(defaultRaw);
