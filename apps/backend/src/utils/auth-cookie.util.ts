import type { CookieOptions, Response } from "express";

export const AUTH_PATH = "/api/v1/auth";

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: AUTH_PATH,
});

export const setRefreshCookie = (res: Response, token: string, seconds: number) => {
  res.cookie("refreshToken", token, { ...cookieOptions(), maxAge: seconds * 1000 });
};

export const clearRefreshCookie = (res: Response) => {
  res.cookie("refreshToken", "", { ...cookieOptions(), maxAge: 0, expires: new Date(0) });
};
