import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type AuthedRequest = Request & { userId?: string; roleId?: string };

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string; roleId?: string };
    req.userId = payload.sub;
    req.roleId = payload.roleId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
