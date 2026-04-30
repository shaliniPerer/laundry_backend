import jwt from "jsonwebtoken";
import { config } from "../config.js";
export function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const payload = jwt.verify(token, config.jwtSecret);
        req.userId = payload.sub;
        req.roleId = payload.roleId;
        next();
    }
    catch {
        res.status(401).json({ error: "Invalid token" });
    }
}
