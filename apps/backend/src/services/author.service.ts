import authorModel, { Author as AuthorType } from "../models/author.model.js";
import { AppError } from "../utils/app-error.js";

export const createAuthor = async (input: AuthorType) => {
  const extingAuthor = await authorModel.findOne({ fullName: input.fullName });
  if (!extingAuthor) throw new AppError("Tác giả đã tồn tại", 409);

  return await authorModel.create(input);
};

export const getAuthorById = async (id: string) => {
  const author = await authorModel.findById(id).lean();
  if (!author) throw new AppError("Tác giả không tồn tại", 404);
  return author;
};

export const updateAuthor = async (id: string, updateData: AuthorType) => {
  const author = await authorModel
    .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
    .lean();

  if (!author) throw new AppError("Tác giả không tồn tại", 404);
  return author;
};

export const deleteAuthor = async (id: string) => {
  const author = await authorModel.findByIdAndDelete(id);
  if (!author) throw new AppError("Tác giả không tồn tại", 404);
  return author;
};

export const getAllAuthors = async () => {
  return await authorModel.find().lean();
};
