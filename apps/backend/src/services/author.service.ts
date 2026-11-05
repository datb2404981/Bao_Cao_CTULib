import authorModel from "../models/author.model.js";
import { AppError } from "../utils/app-error.js";

export interface IAuthor { 
  fullName: String;
  affiliation: String;
  notes: String;
}

export const createAuthor = async (input: IAuthor) => {
  const exitingAuthor = await authorModel.findOne({ fullName: input.fullName });
  if (exitingAuthor) throw new AppError("Tác giả đã tồn tại", 409);

  return await authorModel.create(input);
};

export const getAuthorById = async (authorId:string) => {
  return await authorModel.findById(authorId);
};

export const updateAuthor = async (id:string, updateData: String ) => {
  const exitingAuthor = await getAuthorById(id);
  if (!exitingAuthor) throw new AppError("Tác giả không tại", 404);

  return await authorModel.findByIdAndUpdate(id, updateData)
};