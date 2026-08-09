import { ExpressRuntimeError } from "@nahkies/typescript-express-runtime/errors";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import type { Clock } from "./clock.ts";
import { createRouter } from "./generated/generated.ts";
import { createHandlers } from "./handlers.ts";
import type { Store } from "./store.ts";

export const DEFAULT_FRONTEND_ORIGIN = "http://localhost:5173";

export interface CreateAppOptions {
  store: Store;
  clock: Clock;
  frontendOrigin?: string;
}

export function createApp(options: CreateAppOptions): express.Express {
  const app = express();
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowed = options.frontendOrigin ?? DEFAULT_FRONTEND_ORIGIN;
        callback(null, origin === allowed ? allowed : false);
      },
    }),
  );
  app.use(express.json());
  app.use(createRouter(createHandlers(options.store, options.clock)));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: "not_found" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (ExpressRuntimeError.isExpressError(err)) {
    if (err.phase === "request_validation") {
      res.status(400).json({ code: "bad_request" });
      return;
    }
    res.status(500).json({ code: "internal_error" });
    return;
  }

  const type = (err as { type?: string } | null | undefined)?.type;
  if (type === "entity.too.large") {
    res.status(413).json({ code: "payload_too_large" });
    return;
  }
  if (type === "entity.parse.failed") {
    res.status(400).json({ code: "bad_request" });
    return;
  }

  console.error(err);
  res.status(500).json({ code: "internal_error" });
}
