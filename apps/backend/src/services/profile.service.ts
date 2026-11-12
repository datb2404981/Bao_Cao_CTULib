import { AccountModel } from '../models/user.model.js';
import readerModel from '../models/reader.model.js';
import employeeModel from '../models/employee.model.js';
import facultyModel from '../models/faculty.model.js';
import { getAccountAccess } from './access.service.js';
import { AppError } from '../utils/app-error.js';

export const getOwnProfile = async (id: string) => {
  const access = await getAccountAccess(id);
  const [account, reader, employee] = await Promise.all([
    AccountModel.findById(id).select('createdAt').lean(),
    access.role === 'READER' ? readerModel.findById(id).lean() : null,
    access.role !== 'READER' ? employeeModel.findById(id).lean() : null,
  ]);
  const faculty = reader?.facultyId ? await facultyModel.findById(reader.facultyId).select('facultyName').lean() : null;
  const person = reader || employee;
  return {
    ...access, createdAt: account?.createdAt, hasProfile: Boolean(person),
    fullName: person?.fullName || '', phoneNumber: person?.phoneNumber || '', address: person?.address || '',
    dateOfBirth: reader?.dateOfBirth?.toISOString().slice(0, 10) || '',
    readerType: reader?.readerType || '', facultyName: faculty?.facultyName || '',
    position: employee?.position || '',
  };
};

export const updateOwnEmail = async (id: string, email: string) => {
  await getAccountAccess(id);
  try { await AccountModel.findByIdAndUpdate(id, { $set: { email } }, { runValidators: true }); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 11000) throw new AppError('Email đã được sử dụng', 409);
    throw error;
  }
  return getOwnProfile(id);
};

export const updateOwnPersonalInfo = async (id: string, input: { fullName?: string; phoneNumber?: string; address?: string }) => {
  const access = await getAccountAccess(id);
  const updated = access.role === 'READER'
    ? await readerModel.findByIdAndUpdate(id, { $set: input }, { runValidators: true })
    : await employeeModel.findByIdAndUpdate(id, { $set: input }, { runValidators: true });
  if (!updated) throw new AppError('Hồ sơ cá nhân chưa được tạo. Vui lòng liên hệ thư viện.', 404);
  return getOwnProfile(id);
};
