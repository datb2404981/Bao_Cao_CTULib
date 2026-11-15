import test from "node:test";
import assert from "node:assert/strict";
import { publisherSchema } from "../src/schemas/publisher.schema.js";
import { updateBookSchema } from "../src/schemas/book.schema.js";
import * as publisherService from "../src/services/publisher.service.js";
import * as bookService from "../src/services/book.service.js";
import publisherModel from "../src/models/publisher.model.js";
import facultyModel from "../src/models/faculty.model.js";
import authorModel from "../src/models/author.model.js";
import bookModel from "../src/models/book.model.js";

test("publisherSchema validation", () => {
  const valid = publisherSchema.safeParse({
    publisherName: "NXB Giáo Dục",
    address: "Hà Nội",
  });
  assert.equal(valid.success, true);

  const emptyName = publisherSchema.safeParse({
    publisherName: "",
  });
  assert.equal(emptyName.success, false);
});

test("createPublisher fails when name exists", async () => {
  const originalFindOne = publisherModel.findOne;
  publisherModel.findOne = (() => ({
    _id: "507f1f77bcf86cd799439011",
    publisherName: "NXB Cần Thơ",
  })) as any;

  try {
    await assert.rejects(
      async () => {
        await publisherService.createPublisher({ publisherName: "NXB Cần Thơ" });
      },
      { message: "Nhà xuất bản đã tồn tại" }
    );
  } finally {
    publisherModel.findOne = originalFindOne;
  }
});

test("deletePublisher rejects invalid ID", async () => {
  await assert.rejects(
    async () => {
      await publisherService.deletePublisher("invalid-id");
    },
    { message: "Mã nhà xuất bản không hợp lệ" }
  );
});

test("deletePublisher prevents deletion if books are linked", async () => {
  const validId = "507f1f77bcf86cd799439011";
  const origExists = publisherModel.exists;
  const origBookExists = bookModel.exists;

  publisherModel.exists = (async () => ({ _id: validId })) as any;
  bookModel.exists = (async () => ({ _id: "book-id" })) as any;

  try {
    await assert.rejects(
      async () => {
        await publisherService.deletePublisher(validId);
      },
      { message: "Không thể xóa nhà xuất bản đang có sách liên kết." }
    );
  } finally {
    publisherModel.exists = origExists;
    bookModel.exists = origBookExists;
  }
});

test("createBook rejects non-existent publisherId", async () => {
  const validId = "507f1f77bcf86cd799439011";
  const origFacultyExists = facultyModel.exists;
  const origAuthorCount = authorModel.countDocuments;
  const origPubFindById = publisherModel.findById;

  facultyModel.exists = (async () => ({ _id: validId })) as any;
  authorModel.countDocuments = (async () => 1) as any;
  publisherModel.findById = (() => ({
    select: () => ({
      lean: async () => null,
    }),
  })) as any;

  try {
    await assert.rejects(
      async () => {
        await bookService.createBook({
          title: "Sách test NXB",
          bookType: "TEXTBOOK",
          facultyId: validId as any,
          authorIds: [validId as any],
          publisherId: validId as any,
          totalCopies: 5,
          availableCopies: 5,
          coverPrice: 50000,
          isAvailableForCirculation: true,
        } as any);
      },
      { message: "Nhà xuất bản không tồn tại" }
    );
  } finally {
    facultyModel.exists = origFacultyExists;
    authorModel.countDocuments = origAuthorCount;
    publisherModel.findById = origPubFindById;
  }
});

test("updateBookSchema strips inventory fields and allows partial metadata updates", () => {
  const parsed = updateBookSchema.safeParse({
    title: "Giáo trình mới",
    totalCopies: 999,
    availableCopies: 999,
    publisherId: null,
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.title, "Giáo trình mới");
    assert.equal(parsed.data.publisherId, null);
    assert.equal("totalCopies" in parsed.data, false);
    assert.equal("availableCopies" in parsed.data, false);
  }
});
