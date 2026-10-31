import { timeStamp } from "console";
import mongoose, { InferSchemaType, Schema, Types } from "mongoose";

export interface IRefreshToken extends Document {
  accountId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  isRevoked: boolean;
  createAt: Date;
  updateAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
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
    isActive: {
      type: Boolean,
      default: true,
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

export type Account = InferSchemaType<typeof accountSchema>;
export const AccountModel = mongoose.model("Acount", accountSchema);
