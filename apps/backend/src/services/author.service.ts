import authorModel from "../models/author.model.js";
import { AppError } from "../utils/app-error.js";

export interface IAuthor {
  fullName: string;
  affiliation: string;
  notes: string;
}

export const createAuthor = async (input:IAuthor) => {
  const extingAuthor = await authorModel.findOne({ fullName: input.fullName });
  if (extingAuthor) throw new AppError("Tác giả đã tồn tại", 409)
    ;

  return await authorModel.create(input);
};

export const getAuthorById = async (id:string) => {
  return await authorModel.findById(id);
};

export const updateAuthor = async (id:string, updateData: IAuthor) => {
  const exitingAuthor = await getAuthorById(id);
  if (!exitingAuthor) throw new AppError("Tác giả không tồn tại", 404);

  return await authorModel.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).lean();
};

export const deleteAuthor = async (id:string) => {
  return await authorModel.findByIdAndDelete(id);
};

export const getAllAuthors = async () => {
  return await authorModel.find().lean();
};