import { createRequire } from "node:module";

// Published JavaScript lives in dist/src; npm always includes the root package.json.
// Read that metadata so CLI, protocol client, and adapter cannot drift independently.
export const VERSION: string = (createRequire(import.meta.url)("../../package.json") as { version: string }).version;
