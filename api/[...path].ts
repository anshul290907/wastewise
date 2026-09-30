// Load the ESM bundle produced during the project build. This keeps the
// existing Express/tRPC app together and supports ESM-only dependencies.
import app from "./index.mjs";

export default app;
