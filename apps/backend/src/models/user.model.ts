import { timeStamp } from "console";
import mongoose, { Schema, Types } from "mongoose";

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

const accountSchema = new Schema({
  ctuIdentifier: { type: String, require: true, index: true },
  email: { type: String, unique: true, Option: true },
  password: { type: String, require: true, select: false },
  fullName: { type: String, Option: true },
  role: {
    type: String,
    enum: ['READER', 'EMPLOYEE', 'ADMIN'],
    default: 'READER'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'LOOKED'],
    default: 'ACTIVE'
  },
}, {
  timestamps:true 
})

export const RefreshTokenModel = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
export const AccountModel = mongoose.model('Acount', accountSchema);