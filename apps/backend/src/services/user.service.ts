import bcrypt from "bcryptjs";
import { AccountModel, RefreshTokenModel, } from "../models/user.model.js";
import readerModel from "../models/reader.model.js";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { AppError } from "../utils/app-error.js";

export interface LoginInput {
  ctuIdentifier: string;
  password: string;
}

export interface LoginResponse {
  token: { accessToken: string; refreshToken: string };
  user: {
    accountId: string;
    ctuIdentifier: string;
    email: string;
    role: string;
    isActive: boolean;
  };
}

import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  isRefreshToken,
  SESSION_SECONDS,
} from "../utils/jwt.util.js";

const INVALID_SESSION = "Phiên đăng nhập không hợp lệ hoặc đã hết hạn";

const withAuthDatabase = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Dịch vụ xác thực tạm thời không khả dụng", 503);
  }
};


const login = async (input: LoginInput): Promise<LoginResponse> => {
  const { ctuIdentifier, password } = input;

  const user = await withAuthDatabase(() => AccountModel.findOne({ ctuIdentifier }).select("+password").exec());
  if (!user || !user.password) throw new AppError("Sai thông tin đăng nhập", 400);

  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) throw new AppError("Sai thông tin đăng nhập", 400);

  if (user.isActive === false) throw new AppError("Tài khoản đã bị khóa", 403);

  const tokens = await genarateToken(user._id.toString(), user.ctuIdentifier, user.role);

  if(!tokens.refreshToken) throw new AppError("Dịch vụ xác thực tạm thời không khả dụng", 503)

  return {
    token: tokens,
    user: {
      accountId: user._id.toString(),
      ctuIdentifier: user.ctuIdentifier,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    }
  }
}

export interface RegisterInput{
  ctuIdentifier: string;
  password: string;
  email: string;
}

const register = async (input: RegisterInput):Promise<LoginResponse> => {
  const { ctuIdentifier, password, email } = input;

  const existingUser = await AccountModel.findOne({
    $or: [{ ctuIdentifier }, { email }]
  });

  if (existingUser) {
    if (existingUser.ctuIdentifier === ctuIdentifier)
      throw new AppError("Mã số sinh viên hoặc mã số cán bộ đã được sử dụng", 409);

    if (existingUser.email === email) throw new AppError("Email đã được sử dụng", 409);
  }

  const saltRound = 10;
  const salt = await bcrypt.genSalt(saltRound);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newAccount = await AccountModel.create({
    ctuIdentifier,
    password: hashedPassword,
    email,
    isActive: true,
    role: "READER",
  });

  // Tự động tạo hồ sơ độc giả mặc định để tài khoản mới có thể đặt mượn sách ngay.
  await readerModel.findOneAndUpdate(
    { _id: newAccount._id },
    { $setOnInsert: { _id: newAccount._id, readerType: "STUDENT" } },
    { upsert: true, new: true },
  );

  const tokens = await genarateToken(newAccount._id.toString(), newAccount.ctuIdentifier, newAccount.role);

  return {
    token: tokens,
    user: {
      accountId: newAccount._id.toString(),
      ctuIdentifier: newAccount.ctuIdentifier,
      email: newAccount.email,
      role: newAccount.role,
      isActive: newAccount.isActive,
    }
  }
};

const genarateToken = async (
  accountId: string,
  ctuIdentifier: string,
  role: "READER" | "EMPLOYEE" | "ADMIN",
) => {
  const accessToken = generateAccessToken({ accountId, ctuIdentifier, role });
  const refreshToken = generateRefreshToken();
  await withAuthDatabase(async () => {
    await RefreshTokenModel.create({
      accountId,
      sessionId: crypto.randomUUID(),
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
      isRevoked: false,
    });
  });
  return { accessToken, refreshToken };
};

const refreshAccessToken = async (refreshToken: unknown) => {
  if (!isRefreshToken(refreshToken)) throw new AppError(INVALID_SESSION, 401);

  return withAuthDatabase(async () => {
    const dbSession = await mongoose.startSession();
    try {
      const result = await dbSession.withTransaction(async () => {
        const current = await RefreshTokenModel.findOne({
          tokenHash: hashToken(refreshToken),
        }).session(dbSession);
        const now = new Date();

        if (!current?.sessionId) {
          return { error: new AppError(INVALID_SESSION, 401) };
        }
        if (current.isRevoked) {
          if (current.replacedByTokenId) {
            await RefreshTokenModel.updateMany(
              { sessionId: current.sessionId },
              { $set: { isRevoked: true, revokedAt: now } },
              { session: dbSession },
            );
          }
          return { error: new AppError(INVALID_SESSION, 401) };
        }
        if (Math.floor((current.expiresAt.getTime() - now.getTime()) / 1000) < 1) {
          return { error: new AppError(INVALID_SESSION, 401) };
        }
        const account = await AccountModel.findById(current.accountId).session(dbSession);
        if (!account || !account.isActive) {
          await RefreshTokenModel.updateMany(
            account ? { accountId: account._id } : { sessionId: current.sessionId },
            { $set: { isRevoked: true, revokedAt: now } },
            { session: dbSession },
          );
          return { error: new AppError(account ? "Tài khoản bị khóa" : INVALID_SESSION, account ? 403 : 401) };
        }

        const nextRefreshToken = generateRefreshToken();
        const nextTokenId = new mongoose.Types.ObjectId();
        const accessToken = generateAccessToken({
          accountId: account._id.toString(),
          ctuIdentifier: account.ctuIdentifier,
          role: account.role,
        });
        await RefreshTokenModel.updateOne(
          { _id: current._id, isRevoked: false },
          { $set: { isRevoked: true, revokedAt: now, replacedByTokenId: nextTokenId } },
          { session: dbSession },
        );
        await RefreshTokenModel.create([{
          _id: nextTokenId,
          accountId: current.accountId,
          sessionId: current.sessionId,
          tokenHash: hashToken(nextRefreshToken),
          expiresAt: current.expiresAt,
          isRevoked: false,
        }], { session: dbSession });
        return { accessToken, refreshToken: nextRefreshToken, expiresAt: current.expiresAt };
      });
      if (!result) throw new AppError("Dịch vụ xác thực tạm thời không khả dụng", 503);
      // Throw sau commit để giữ lại việc thu hồi khi phát hiện replay.
      if ("error" in result) throw result.error;
      return result;
    } finally {
      await dbSession.endSession();
    }
  });
};

const logout = async (refreshToken: unknown) => {
  if (!isRefreshToken(refreshToken)) return;
  await withAuthDatabase(async () => {
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const current = await RefreshTokenModel.findOne({
          tokenHash: hashToken(refreshToken),
        }).session(dbSession);
        if (!current?.sessionId) return;
        await RefreshTokenModel.updateMany(
          { sessionId: current.sessionId },
          { $set: { isRevoked: true, revokedAt: new Date() } },
          { session: dbSession },
        );
      });
    } finally {
      await dbSession.endSession();
    }
  });
};

export { login, register, refreshAccessToken, logout };
