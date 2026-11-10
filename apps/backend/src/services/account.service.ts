import { isValidObjectId } from 'mongoose';
import { AccountModel } from '../models/user.model.js';
import readerModel from '../models/reader.model.js';
import employeeModel from '../models/employee.model.js';
import { AppError } from '../utils/app-error.js';
import { accountListQuerySchema, type UpdateAccountInput } from '../schemas/account.schema.js';

export const listAccounts = async (query: unknown) => {
  const parsed = accountListQuerySchema.safeParse(query);
  if (!parsed.success) throw new AppError('Bộ lọc tài khoản không hợp lệ', 400);
  const { page, limit, search, role, isActive } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (isActive) filter.isActive = isActive === 'true';
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const [matchingReaders, matchingEmployees] = await Promise.all([
      readerModel.find({ fullName: { $regex: escaped, $options: 'i' } }).select('_id').lean(),
      employeeModel.find({ fullName: { $regex: escaped, $options: 'i' } }).select('_id').lean(),
    ]);
    filter.$or = [
      { ctuIdentifier: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { _id: { $in: [...matchingReaders, ...matchingEmployees].map((profile) => profile._id) } },
    ];
  }
  const [accounts, totalItems] = await Promise.all([
    AccountModel.find(filter).select('_id ctuIdentifier email role isActive createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AccountModel.countDocuments(filter),
  ]);
  const ids = accounts.map((account) => account._id);
  const [readers, employees] = await Promise.all([
    readerModel.find({ _id: { $in: ids } }).select('fullName isBorrowingBlocked isBorrowingManuallyBlocked').lean(),
    employeeModel.find({ _id: { $in: ids } }).select('fullName').lean(),
  ]);
  const readerProfiles = new Map(readers.map((profile) => [profile._id.toString(), profile]));
  const employeeProfiles = new Map(employees.map((profile) => [profile._id.toString(), profile]));
  return {
    items: accounts.map((account) => {
      const key = account._id.toString();
      const reader = readerProfiles.get(key);
      const employee = employeeProfiles.get(key);
      return {
        ...account,
        fullName: (account.role === 'READER' ? reader?.fullName : employee?.fullName) || '',
        ...(account.role === 'READER' && reader ? {
          isBorrowingBlocked: Boolean(reader.isBorrowingBlocked),
          isBorrowingManuallyBlocked: Boolean(reader.isBorrowingManuallyBlocked),
        } : {}),
      };
    }),
    meta: { totalItems, currentPage: page, totalPages: Math.max(1, Math.ceil(totalItems / limit)), limit },
  };
};

export const updateAccount = async (id: string, input: UpdateAccountInput, actorId: string) => {
  if (!isValidObjectId(id)) throw new AppError('Mã tài khoản không hợp lệ', 400);
  if (id === actorId && input.isActive === false) throw new AppError('Không thể vô hiệu hóa tài khoản của chính mình', 409);
  try {
    const account = await AccountModel.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true })
      .select('_id ctuIdentifier email role isActive createdAt').lean();
    if (!account) throw new AppError('Tài khoản không tồn tại', 404);
    return account;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 11000) throw new AppError('Email đã được sử dụng', 409);
    throw error;
  }
};
