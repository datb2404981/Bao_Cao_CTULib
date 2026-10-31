import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { token } from "morgan";

export interface TokenPayload {
  accountId: string;
  ctuIdentifier: string;
  role: "READER" | "EMPLOYEE" | "ADMIN";
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_SECRET_KEY: string = process.env.ACCESS_TOKEN_SECRET_KEY as string;
const REFRESH_TOKEN_SECRET_KEY: string = process.env.REFRESH_TOKEN_SECRET_KEY as string;
const ACCESS_TOKEN_EXPIRY: string = process.env.ACCESS_TOKEN_EXPIRY as string;
const REFRESH_TOKEN_EXPIRY: string = process.env.REFRESH_TOKEN_EXPIRY as string;

export const genarateTokens = (payload: TokenPayload): AuthToken => {
  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET_KEY, { expiresIn: ACCESS_TOKEN_EXPIRY } as SignOptions);

  const refreshToken =  jwt.sign(payload, REFRESH_TOKEN_SECRET_KEY, { expiresIn: REFRESH_TOKEN_EXPIRY } as SignOptions);

  return {
    accessToken,
    refreshToken
  };
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET_KEY) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET_KEY) as TokenPayload;
};