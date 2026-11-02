import crypto from "crypto";
import jwt from "jsonwebtoken";
import { AppError } from "./app-error.js";

export interface TokenPayload {
  accountId: string;
  ctuIdentifier: string;
  role: "READER" | "EMPLOYEE" | "ADMIN";
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
}

export const ACCESS_TOKEN_SECONDS = 900;
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

const getAccessSecret = (): string => {
  const secret = process.env.ACCESS_TOKEN_SECRET_KEY;
  if (!secret) throw new AppError("Dịch vụ xác thực tạm thời không khả dụng", 503);
  return secret;
};

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, getAccessSecret(), {
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_SECONDS,
    subject: payload.accountId,
    issuer: "ctulib-api",
    audience: "ctulib-web",
    jwtid: crypto.randomUUID(),
  });
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(32).toString("base64url");
};

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};
export const verifyToken = (value: string): TokenPayload => {
  try {
    const decoded = jwt.verify(value, getAccessSecret(), {
      algorithms: ["HS256"],
      issuer: "ctulib-api",
      audience: "ctulib-web",
    });

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      decoded.accountId !== decoded.sub ||
      typeof decoded.ctuIdentifier !== "string" ||
      !["READER", "EMPLOYEE", "ADMIN"].includes(decoded.role)
    ) {
      throw new AppError("Access token không hợp lệ", 401);
    }

    return {
      accountId: decoded.sub,
      ctuIdentifier: decoded.ctuIdentifier,
      role: decoded.role,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError("Access token không hợp lệ hoặc đã hết hạn", 401);
    }

    // Lỗi cấu hình hoặc lỗi hệ thống vẫn để middleware xử lý 500.
    throw error;
  }
};

export const isRefreshToken = (value: unknown): value is string => {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
};
