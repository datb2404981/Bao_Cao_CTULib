import { RequestHandler } from "express";
import { AppError } from "../utils/app-error.js";
import { login } from "../services/user.service.js";
import { token } from "morgan";

const loginController: RequestHandler = async (req, res, next) => {
  try {
    const {ctuIdentifier, password} = req.body;
    if (!ctuIdentifier || !password) {
      throw new AppError ("Dữ liệu không hợp lệ", 400)
    }

    const result = await login({ ctuIdentifier, password });

    res.cookie("refreshToken", result.token.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 24 * 1000,
      path: "/"
    })

    res.status(200).json({
      status: "success",
      message: "Đăng nhập thành công, trả về Token và Thông tin user",
      data: {
        token: result.token.accessToken,
        tokenType: "Bearer",
        expiresIn: 1800,
        user: result.user
      }
    })
  } catch (error) {
    next(error);
  }
}

export {
  loginController
}