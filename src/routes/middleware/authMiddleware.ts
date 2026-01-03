import { timingSafeEqual } from "crypto";
import { NextFunction, Request, Response } from "express";

const API_KEY = process.env.WG_API_KEY;

if (!API_KEY) {
  throw new Error("WG_API_KEY is not set");
}

if (API_KEY.length < 32) {
  throw new Error("WG_API_KEY must be at least 32 characters long");
}

const API_KEY_BUFFER = new Uint8Array(Buffer.from(API_KEY, "utf8"));

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check for API key in Authorization header (Bearer token) or X-API-Key header
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;

  let providedKey: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    providedKey = authHeader.substring(7);
  } else if (apiKeyHeader) {
    providedKey = apiKeyHeader;
  }

  if (!providedKey) {
    return res.status(401).json({ error: "Unauthorized: Invalid API key" });
  }

  const providedKeyBuffer = new Uint8Array(Buffer.from(providedKey, "utf8"));

  if (providedKeyBuffer.length !== API_KEY_BUFFER.length) {
    return res.status(401).json({ error: "Unauthorized: Invalid API key" });
  }

  try {
    if (!timingSafeEqual(providedKeyBuffer, API_KEY_BUFFER)) {
      return res.status(401).json({ error: "Unauthorized: Invalid API key" });
    }
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized: Invalid API key" });
  }

  next();
};
