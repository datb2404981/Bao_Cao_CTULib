import publisherModel, { Publisher as PublisherType } from "../models/publisher.model.js";
import bookModel from "../models/book.model.js";
import { AppError } from "../utils/app-error.js";

export const createPublisher = async (input: Partial<PublisherType>) => {
  const publisherName = input.publisherName?.trim();
  if (!publisherName) throw new AppError("Tên nhà xuất bản không được để trống", 400);

  const existing = await publisherModel.findOne({ publisherName });
  if (existing) throw new AppError("Nhà xuất bản đã tồn tại", 409);

  if (input.publisherCode?.trim()) {
    const existingCode = await publisherModel.findOne({ publisherCode: input.publisherCode.trim().toUpperCase() });
    if (existingCode) throw new AppError("Mã nhà xuất bản đã tồn tại", 409);
  }

  return await publisherModel.create({
    ...input,
    publisherName,
  });
};

export const getPublisherById = async (id: string) => {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    throw new AppError("Nhà xuất bản không tồn tại", 404);
  }
  const publisher = await publisherModel.findById(id).lean();
  if (!publisher) throw new AppError("Nhà xuất bản không tồn tại", 404);
  return publisher;
};

export const updatePublisher = async (id: string, updateData: Partial<PublisherType>) => {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    throw new AppError("Nhà xuất bản không tồn tại", 404);
  }

  const normalizedData: Partial<PublisherType> = { ...updateData };

  if (updateData.publisherName !== undefined) {
    const publisherName = updateData.publisherName.trim();
    if (!publisherName) {
      throw new AppError("Tên nhà xuất bản không được để trống", 400);
    }
    const existing = await publisherModel.findOne({
      publisherName,
      _id: { $ne: id },
    });
    if (existing) throw new AppError("Tên nhà xuất bản đã tồn tại", 409);
    normalizedData.publisherName = publisherName;
  }

  if (updateData.publisherCode?.trim()) {
    const existingCode = await publisherModel.findOne({
      publisherCode: updateData.publisherCode.trim().toUpperCase(),
      _id: { $ne: id },
    });
    if (existingCode) throw new AppError("Mã nhà xuất bản đã tồn tại", 409);
  }

  const publisher = await publisherModel
    .findByIdAndUpdate(id, normalizedData, { new: true, runValidators: true })
    .lean();

  if (!publisher) throw new AppError("Nhà xuất bản không tồn tại", 404);

  if (normalizedData.publisherName) {
    await bookModel.updateMany(
      { publisherId: id },
      { $set: { publisher: publisher.publisherName } },
    );
  }

  return publisher;
};

export const deletePublisher = async (id: string) => {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    throw new AppError("Mã nhà xuất bản không hợp lệ", 400);
  }

  const publisherExists = await publisherModel.exists({ _id: id });
  if (!publisherExists) throw new AppError("Nhà xuất bản không tồn tại", 404);

  // Check if any books are associated with this publisher
  if (await bookModel.exists({ publisherId: id })) {
    throw new AppError("Không thể xóa nhà xuất bản đang có sách liên kết.", 409);
  }

  const publisher = await publisherModel.findByIdAndDelete(id);
  if (!publisher) throw new AppError("Nhà xuất bản không tồn tại", 404);
  return publisher;
};

export const getAllPublishers = async () => {
  return await publisherModel.find().sort({ createdAt: -1 }).lean();
};
