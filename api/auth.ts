import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export type Role = "Admin" | "Seller" | "Compras";

export interface AuthUser {
  sub: string;
  role: Role;
}

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error(
    "JWT_SECRET is required. Generate one with `openssl rand -base64 48` and add it to .env."
  );
}

const EXPIRES_IN = "12h";

export function signToken(user: { id: string; role: Role }): string {
  return jwt.sign({ role: user.role }, SECRET as string, {
    subject: user.id,
    expiresIn: EXPIRES_IN,
  });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, SECRET as string) as jwt.JwtPayload;
    if (!decoded.sub || typeof decoded.sub !== "string") return null;
    const role = decoded.role as Role | undefined;
    if (role !== "Admin" && role !== "Seller" && role !== "Compras") return null;
    return { sub: decoded.sub, role };
  } catch {
    return null;
  }
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = readBearer(req);
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.user = user;
  next();
}

// Always returns the auth check + role check together — never use a bare
// role check, or req.user will be undefined and you'll 401 every request.
// Express flattens middleware arrays, so callers pass this in a single
// position: app.post(path, requireAdmin, handler).
export function requireRole(...roles: Role[]) {
  const check = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
  return [requireAuth, check];
}

export const requireAdmin = requireRole("Admin");
