import { facultyModel } from "../models/faculty.model.js";
import { AppError } from "../utils/app-error.js";

export interface IFaculty {
  facultyName: string;
  description?: string;
}

export const createFaculty = async (input: IFaculty) => {
  const exitingFaculty = await getFacultyByName(input.facultyName);
  if (exitingFaculty) { 
    throw new AppError("Khoa đã tồn tại", 409);
  }

  return await facultyModel.create(input);
};

export const getFacultyByName = async (facultyName:string) => {
  return facultyModel.findOne({ facultyName });
};

export const getFacultyById = async (facultyId: string) => {
  if (!/^[a-fA-F0-9]{24}$/.test(facultyId)) {
    throw new AppError("Mã khoa không hợp lệ", 400);
  }

  const faculty = await facultyModel.findById(facultyId);
  if (!faculty) throw new AppError("Khoa không tồn tại", 404);
  return faculty;
};

export const updateFaculaty = async (facultyId: string, data: IFaculty) => {
  if (!/^[a-fA-F0-9]{24}$/.test(facultyId)) {
    throw new AppError("Mã khoa không hợp lệ", 400);
  }
  
  const faculaty = await facultyModel.findByIdAndUpdate(
    facultyId,
    { $set: data },
    { new: true, runValidators: true }
  );

  if (!faculaty) throw new AppError("Khoa không tồn tại", 404);
  return faculaty;
};

export const deleteFaculaty = async (facultyId: string) => {
  if (!/^[a-fA-F0-9]{24}$/.test(facultyId)) {
    throw new AppError("Mã khoa không hợp lệ", 400);
  }

  const faculty = await facultyModel.findByIdAndDelete(facultyId);
  if (!faculty) throw new AppError("Khoa không tồn tại", 404);
  return faculty;
};

export const getAllFaculties = async () => {
  return await facultyModel.find()
};