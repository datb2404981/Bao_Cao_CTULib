import { isValidObjectId } from "mongoose";
import readerModel from "../models/reader.model.js";
import facultyModel from "../models/faculty.model.js";
import { AccountModel } from "../models/user.model.js";
import type { CreateReaderInput, UpdateReaderInput } from "../schemas/reader.schema.js";
import { AppError } from "../utils/app-error.js";

const validateId = (id: string) => {
  if (!isValidObjectId(id)) throw new AppError("Mã độc giả không hợp lệ", 400);
};
const checkFaculty = async (id: string) => {
  if (!(await facultyModel.exists({ _id: id })))
    throw new AppError("Khoa không tồn tại", 404);
};

export const createReader = async (input: CreateReaderInput) => {
  const account = await AccountModel.findById(input.accountId).lean();
  if (!account) throw new AppError("Tài khoản không tồn tại", 404);
  if (account.role !== "READER") throw new AppError("Tài khoản không phải độc giả", 400);

  await checkFaculty(input.facultyId);
  const { accountId, ...data } = input;
  try {
    return await readerModel.create({ ...data, _id: accountId });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      throw new AppError("Hồ sơ độc giả đã tồn tại", 409);
    throw error;
  }
};

export const getAllReaders = async () => readerModel.find().lean();
export const getReaderById = async (id: string) => {
  validateId(id);
  const reader = await readerModel.findById(id).lean();
  if (!reader) throw new AppError("Độc giả không tồn tại", 404);
  return reader;
};
export const updateReader = async (id: string, data: UpdateReaderInput) => {
  validateId(id);
  if (data.facultyId) await checkFaculty(data.facultyId);
  const reader = await readerModel
    .findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
    .lean();
  if (!reader) throw new AppError("Độc giả không tồn tại", 404);
  return reader;
};
