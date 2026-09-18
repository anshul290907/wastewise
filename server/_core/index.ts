import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerGoogleOAuthRoutes } from "../auth/google";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();

    server.listen(port, () => {
      server.close(() => resolve(true));
    });

    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available port found starting from ${startPort}`);
}

// Create the Express application
export const app = express();

// Configure body parser with larger size limit for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerStorageProxy(app);
registerGoogleOAuthRoutes(app);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Development mode uses Vite
// Production mode serves the built frontend
async function configureApp() {
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");

    const server = createServer(app);
    await setupVite(app, server);
    return server;
  } else {
    const { serveStatic } = await import("./vite");

    serveStatic(app);
    return null;
  }
}

// Local development server
async function startServer() {
  const server = await configureApp();

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(
      `Port ${preferredPort} is busy, using port ${port} instead`
    );
  }

  if (server) {
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}/`);
    });
  }
}

// Only start a real server local
// ly.
// Vercel imports `app` as a serverless function instead.
if (!process.env.VERCEL) {
  startServer().catch(console.error);
}

export default app;