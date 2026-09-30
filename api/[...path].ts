// Let Vercel bundle the Express application as an ESM serverless function.
// A hand-built CommonJS bundle breaks because jose is ESM-only.
import app from "../server/vercel";

export default app;
