import mongoose, { type InferSchemaType, Schema, Types } from "mongoose";

export interface IRefreshToken {
  accountId: Types.ObjectId;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  replacedByTokenId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
    isRevoked: {
      type: Boolean,
      required: true,
      default: false,
    },
    revokedAt: Date,
    replacedByTokenId: {
      type: Schema.Types.ObjectId,
      ref: "RefreshToken",
    },
  },
  {
    timestamps: true,
  },
);

export const RefreshTokenModel = mongoose.model<IRefreshToken>(
  "RefreshToken",
  refreshTokenSchema,
);
const accountSchema = new Schema(
  {
    ctuIdentifier: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["READER", "EMPLOYEE", "ADMIN"],
      default: "READER",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type Account = InferSchemaType<typeof accountSchema>;
export const AccountModel = mongoose.model("Account", accountSchema, "accounts");
