import { RequestHandler } from "express";
import { AppError } from "../utils/app-error.js";
import { login, logout, refreshAccessToken, register } from "../services/user.service.js";

import { ACCESS_TOKEN_SECONDS, SESSION_SECONDS } from "../utils/jwt.util.js";
import { setRefreshCookie, clearRefreshCookie } from "../utils/auth-cookie.util.js";

const loginController: RequestHandler = async (req, res, next) => {
  try {
    const {ctuIdentifier, password} = req.body;
    if (!ctuIdentifier || !password) {
      throw new AppError ("Dữ liệu không hợp lệ", 400)
    }

    const result = await login({ ctuIdentifier, password });

    setRefreshCookie(res, result.token.refreshToken, SESSION_SECONDS);

    res.status(200).json({
      status: "success",
      message: "Đăng nhập thành công, trả về Token và Thông tin user",
      data: {
        token: result.token.accessToken,
        tokenType: "Bearer",
        expiresIn: ACCESS_TOKEN_SECONDS,
        user: result.user
      }
    })
  } catch (error) {
    next(error);
  }
}

const registerController: RequestHandler = async (req, res, next) => {
  const { ctuIdentifier, password, email } = req.body;
  try {
    const result = await register({ ctuIdentifier, password, email });
    setRefreshCookie(res, result.token.refreshToken, SESSION_SECONDS);

    res.status(201).json({
      status: "success",
      message: "Đăng ký tài khoản thành công, trả về Token và Thông tin user",
      data: {
        token: result.token.accessToken,
        tokenType: "Bearer",
        expiresIn: ACCESS_TOKEN_SECONDS,
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
}

const refreshController: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    const result = await refreshAccessToken(refreshToken);
    const remainingSeconds = Math.floor((result.expiresAt.getTime() - Date.now()) / 1000);
    if (remainingSeconds < 1) {
      throw new AppError("Phiên đăng nhập không hợp lệ hoặc đã hết hạn", 401);
    }
    setRefreshCookie(res, result.refreshToken, remainingSeconds);

    res.status(200).json({
      status: "success",
      message: "Làm mới token thành công",
      data: {
        token: result.accessToken,
        tokenType: "Bearer",
        expiresIn: ACCESS_TOKEN_SECONDS,
      }
    })
  } catch (error) {
    if (error instanceof AppError && [401, 403].includes(error.statusCode)) {
      clearRefreshCookie(res);
    }
    next(error);
  }
};

const logoutController: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    await logout(refreshToken);

    clearRefreshCookie(res);

    res.status(200).json({
      status: "success",
      message: "Đăng xuất thành công",
      data: null,
    })
  } catch (error) {
    next(error);
  }
};

export { loginController, registerController, refreshController, logoutController };