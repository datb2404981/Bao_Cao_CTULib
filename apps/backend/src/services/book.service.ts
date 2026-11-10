import id from "zod/v4/locales/id.cjs";
import authorModel from "../models/author.model.js";
import BookModel, {Book} from "../models/book.model.js";
import facultyModel from "../models/faculty.model.js";
import { AppError } from "../utils/app-error.js";
import type { InventoryAdjustmentInput } from "../schemas/book.schema.js";


const toBookResponse = (b: any) => {
  const doc = b.toObject ? b.toObject() : b;
  const { _id, __v, coverImageURL, ...rest } = doc;
  return {
    bookId: _id.toString(),
    ...rest,
    facultyId: rest.facultyId?._id?.toString() || rest.facultyId?.toString(),
    authorIds: (rest.authorIds || []).map((a: any) => a?._id?.toString() || a?.toString()),
    availableCopies: rest.availableCopies ?? rest.totalCopies,
    ...(coverImageURL || rest.coverImageUrl ? { coverImageUrl: coverImageURL || rest.coverImageUrl } : {}),
  };
};

const checkRelations = async (facultyId?: string, authorIds?: string[]) => {
  if (facultyId && !(await facultyModel.exists({ _id: facultyId }))) {
    throw new AppError("Khoa không tồn tại", 400);
  }
  if (authorIds) {
    if (!authorIds.length) throw new AppError("Sách phải có ít nhất một tác giả", 400);
    const count = await authorModel.countDocuments({
      _id: { $in: [...new Set(authorIds)] },
    });
    if (count !== new Set(authorIds).size) {
      throw new AppError("Một số tác giả không tồn tại", 400);
    }
  }
};

export const createBook = async (input: Book) => {
  await checkRelations(input.facultyId.toString(), input.authorIds?.map((id)=> id.toString()));

  // availableCopies do server tính từ totalCopies, không nhận từ client
  const book = await BookModel.create({
    ...input,
    availableCopies: input.totalCopies,
  });

  return toBookResponse(book);
};

export interface GetBooksQuery {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
  facultyId?: unknown;
  bookType?: unknown;
}

export const getAllBooks = async (query: GetBooksQuery = {}) => {
  const { page, limit, search, facultyId, bookType } = query;

  if (page !== undefined) {
    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum <= 0) {
      throw new AppError("Tham số trang không hợp lệ", 400);
    }
  }

  if (limit !== undefined) {
    const limitNum = Number(limit);
    if (!Number.isInteger(limitNum) || limitNum <= 0) {
      throw new AppError("Tham số giới hạn không hợp lệ", 400);
    }
  }

  if (bookType !== undefined && bookType !== "TEXTBOOK" && bookType !== "REFERENCE") {
    throw new AppError("Loại sách không hợp lệ", 400);
  }

  const p = Number(page) || 1;
  const l = Number(limit) || 10;

  const conditions: any[] = [];

  if (search && typeof search === "string" && search.trim() !== "") {
    const s = search.trim();
    const matchingAuthors = await authorModel
      .find({ fullName: { $regex: s, $options: "i" } })
      .select("_id");
    const matchedAuthorIds = matchingAuthors.map((a) => a._id);

    conditions.push({
      $or: [
        { title: { $regex: s, $options: "i" } },
        { authorIds: { $in: matchedAuthorIds } },
      ],
    });
  }

  if (facultyId && typeof facultyId === "string" && facultyId.trim() !== "") {
    conditions.push({ facultyId: facultyId.trim() });
  }


  if (bookType) {
    conditions.push({ bookType });
  }

  const filter = conditions.length > 0 ? { $and: conditions } : {};

  const totalItems = await BookModel.countDocuments(filter);
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / l);
  const items = await BookModel.find(filter)
    .skip((p - 1) * l)
    .limit(l);

  return {
    items: items.map(toBookResponse),
    meta: {
      totalItems,
      totalPages,
      currentPage: p,
      limit: l,
    },
  };
};

export const getBookById = async (id: string) => {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    throw new AppError("Sách không tồn tại", 404);
  }

  const book = await BookModel.findById(id);
  if (!book) throw new AppError("Sách không tồn tại", 404);
  return toBookResponse(book);
};

export const updateBook = async (id: string, input: Book) => {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    throw new AppError("Sách không tồn tại", 404);
  }

  await checkRelations(input.facultyId.toString(), input.authorIds.map(id => id.toString()));
  const book = await BookModel.findByIdAndUpdate(id, input, {
    new: true,
    runValidators: true,
  });
  if (!book) throw new AppError("Sách không tồn tại", 404);
  return toBookResponse(book);
};

export const deleteBook = async (id: string) => {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    throw new AppError("Sách không tồn tại", 404);
  }

  const book = await BookModel.findByIdAndDelete(id);
  if (!book) throw new AppError("Sách không tồn tại", 404);
  return toBookResponse(book);
};

export const adjustBookInventory = async (id: string, input: InventoryAdjustmentInput, accountId: string) => {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) throw new AppError("Sách không tồn tại", 404);
  const minimum = Math.max(0, -input.delta);
  const book = await BookModel.findOneAndUpdate({
    _id: id,
    totalCopies: { $gte: minimum },
    availableCopies: { $gte: minimum },
  }, {
    $inc: { totalCopies: input.delta, availableCopies: input.delta },
    $push: { inventoryAdjustments: { delta: input.delta, reason: input.reason, accountId, createdAt: new Date() } },
  }, { new: true, runValidators: true });
  if (!book) {
    if (!(await BookModel.exists({ _id: id }))) throw new AppError("Sách không tồn tại", 404);
    throw new AppError("Số sách khả dụng không đủ để giảm kho", 409);
  }
  return toBookResponse(book);
};
