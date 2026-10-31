import bcrypt from "bcryptjs";
import { AccountModel, RefreshTokenModel, } from "../models/user.model.js";
import { genarateTokens, hashToken } from "../utils/jwt.util.js";
import { AppError } from "../utils/app-error.js";

export interface LoginInput {
  ctuIdentifier: string;
  password: string;
}

export interface LoginResponse {
  token: {
    accessToken: string;
    refreshToken: string;
  };
  user: {
    accountId: string;
    ctuIdentifier: string;
    role: string;
  };
}


const login = async (input: LoginInput): Promise<LoginResponse> => {
  const { ctuIdentifier, password } = input;
  
  const user = await AccountModel.findOne({ ctuIdentifier}).select("+password");
  if (!user || !user.password) throw new AppError("Sai thông tin đăng nhập", 400);

  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) throw new AppError("Sai thông tin đăng nhập", 400);

  if (user.isActive === false) throw new AppError("Tài khoản đã bị khóa", 403);

  const tokens = genarateTokens({
    accountId: user._id.toString(),
    ctuIdentifier: user.ctuIdentifier,
    role: user.role,
  });

  const hashRefreshToken = hashToken(tokens.refreshToken);
  const maxAgeRefreshToken = 7 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + maxAgeRefreshToken);

  const RefreshToken = await RefreshTokenModel.create({
    accountId: user._id,
    tokenHash: hashRefreshToken,
    expiresAt,
  });
  if(!RefreshToken) throw new AppError("Dịch vụ xác thực tạm thời không khả dụng", 503)

  return {
    token: tokens,
    user: {
      accountId: user._id.toString(),
      ctuIdentifier: user.ctuIdentifier,
      role: user.role,
    }
  }
}

export const findAccountByIdentifier = async (ctuIdentifier: string) => {
  return await AccountModel.findOne({ ctuIdentifier});
};

export {
  login,
}