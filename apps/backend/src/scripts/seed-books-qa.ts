import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import authorModel from "../models/author.model.js";
import { BookModel } from "../models/book.model.js";
import { facultyModel } from "../models/faculty.model.js";
import { AccountModel } from "../models/user.model.js";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Thiếu biến môi trường MONGODB_URI trong .env");
  }

  console.log("Đang kết nối MongoDB...");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log("Kết nối thành công!");

  // 1. Seed Accounts cho QA / Apidog
  console.log("\n--- [1/4] Seeding Accounts ---");
  const accounts = [
    {
      ctuIdentifier: "B9900001",
      email: "b9900001@example.com",
      password: "QaReader123!",
      role: "READER",
      isActive: true,
    },
    {
      ctuIdentifier: "B9900002",
      email: "b9900002@example.com",
      password: "QaReader123!",
      role: "READER",
      isActive: true,
    },
    {
      ctuIdentifier: "CB99101",
      email: "cb99101@example.com",
      password: "QaBusiness123!",
      role: "EMPLOYEE",
      isActive: true,
    },
    {
      ctuIdentifier: "CB99102",
      email: "cb99102@example.com",
      password: "QaBusiness123!",
      role: "EMPLOYEE",
      isActive: true,
    },
    {
      ctuIdentifier: "CB99103",
      email: "cb99103@example.com",
      password: "QaBusiness123!",
      role: "EMPLOYEE",
      isActive: true,
    },
    {
      ctuIdentifier: "ADMIN99101",
      email: "admin99101@example.com",
      password: "QaBusiness123!",
      role: "ADMIN",
      isActive: true,
    },
  ];

  for (const acc of accounts) {
    const passwordHash = await bcrypt.hash(acc.password, 10);
    await AccountModel.findOneAndUpdate(
      { ctuIdentifier: acc.ctuIdentifier },
      {
        ctuIdentifier: acc.ctuIdentifier,
        email: acc.email,
        password: passwordHash,
        role: acc.role,
        isActive: acc.isActive,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Account ${acc.ctuIdentifier} (${acc.role})`);
  }

  // 2. Seed Faculties (Khoa)
  console.log("\n--- [2/4] Seeding Faculties ---");
  const facultyData = [
    { _id: new Types.ObjectId("69cabe960354ac17e1a6b400"), facultyName: "Khoa Công nghệ Thông tin & Truyền thông" },
    { _id: new Types.ObjectId("ee584419975de7543b8c2fd2"), facultyName: "Khoa Kỹ thuật Phần mềm" },
    { _id: new Types.ObjectId("7b8bb20178062966c9ee3fa6"), facultyName: "Khoa Khoa học Máy tính" },
    { _id: new Types.ObjectId("0c4323c23034eb5889a9c03f"), facultyName: "Khoa Hệ thống Thông tin" },
    { _id: new Types.ObjectId("cae0f440bef882ce04faec01"), facultyName: "Khoa Mạng Máy tính" },
    { _id: new Types.ObjectId("c33925d474efccde824a79da"), facultyName: "Khoa An toàn Thông tin" },
    { _id: new Types.ObjectId("15842463b2c1feac26739bdb"), facultyName: "Khoa Khoa học Dữ liệu" },
    { _id: new Types.ObjectId("591bc5c2118feabb6a0f62c2"), facultyName: "Khoa Trí tuệ Nhân tạo" },
    { _id: new Types.ObjectId("268faeb7dee782d674af2be2"), facultyName: "Khoa Công nghệ Đa phương tiện" },
    { _id: new Types.ObjectId("1b42a0e928e96ffb5dbffec8"), facultyName: "Khoa Điện tử Viễn thông" },
    { _id: new Types.ObjectId("bfc6bdd70a209c14c378d702"), facultyName: "Khoa Tự động hóa" },
    { _id: new Types.ObjectId("acdbd60380d4184329ff2669"), facultyName: "Khoa Cơ điện tử" },
    { _id: new Types.ObjectId("2f4d9cfb1e1f495d1a54c5c9"), facultyName: "Khoa Kinh tế" },
    { _id: new Types.ObjectId("14ab370efea1b5d9c4d51986"), facultyName: "Khoa Luật" },
    { _id: new Types.ObjectId("4e02fedd178b2a630abf4a5f"), facultyName: "Khoa Sư phạm" },
  ];

  for (const f of facultyData) {
    await facultyModel.findByIdAndUpdate(f._id, f, { upsert: true, new: true });
    console.log(`✓ Faculty ${f._id} - ${f.facultyName}`);
  }

  // 3. Seed Authors (Tác giả)
  console.log("\n--- [3/4] Seeding Authors ---");
  const authorData = [
    { _id: new Types.ObjectId("3028c4b741766ed91a3b43ac"), fullName: "Tác giả kiểm thử một", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("9d458de4ad9937662b64fbfc"), fullName: "Nguyễn Văn A", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("71d33b1a53006cc4aa1644ea"), fullName: "Trần Thị B", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("813c165b98aa3fd3daf0d1ab"), fullName: "Lê Văn C", affiliation: "ĐH Bách Khoa" },
    { _id: new Types.ObjectId("6315e8ca23f8fe13da831df0"), fullName: "Phạm Văn D", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("8c0bce65297777a1b5de668d"), fullName: "Hoàng Thị E", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("667dc742f88fc2272b4ba952"), fullName: "Đỗ Văn F", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("0923618d06f9869b196be887"), fullName: "Vũ Thị G", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("9d892f23137ffd7389834d83"), fullName: "Bùi Văn H", affiliation: "ĐH Quốc Gia" },
    { _id: new Types.ObjectId("468e519ef3e4592008cbaf14"), fullName: "Đặng Thị I", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("cc9dd4bb08637b25b189f838"), fullName: "Hồ Văn K", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("c810e386aa7a056bd060d4e3"), fullName: "Dương Thị L", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("dcea843597642c0636dd2387"), fullName: "Ngô Văn M", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("6e0848f5b6dd17ee3af24a72"), fullName: "Lý Thị N", affiliation: "ĐH Cần Thơ" },
    { _id: new Types.ObjectId("56b5ed21b18144492b4d7019"), fullName: "Mai Văn P", affiliation: "ĐH Cần Thơ" },
  ];

  for (const a of authorData) {
    await authorModel.findByIdAndUpdate(a._id, a, { upsert: true, new: true });
    console.log(`✓ Author ${a._id} - ${a.fullName}`);
  }

  // 4. Seed Books (Chính xác 12 cuốn sách cho fixture BOOK-LIST-001)
  console.log("\n--- [4/4] Seeding 12 Books (Fixture ctulib-business-v1) ---");
  await BookModel.deleteMany({});

  const books = [
    {
      _id: new Types.ObjectId("56e6630ff48c0647904890f3"), // ID khớp BOOK-DETAIL-001
      title: "Lập trình Web với Node.js và TypeScript",
      facultyId: new Types.ObjectId("ee584419975de7543b8c2fd2"), // Khớp BOOK-LIST-005
      authorIds: [new Types.ObjectId("3028c4b741766ed91a3b43ac")], // Tác giả kiểm thử một (khớp BOOK-LIST-003)
      bookType: "TEXTBOOK",
      publisher: "NXB Đại học Cần Thơ",
      publicationYear: 2024,
      coverPrice: 120000,
      totalCopies: 20,
      availableCopies: 15,
      isAvailableForCirculation: true,
    },
    {
      _id: new Types.ObjectId(),
      title: "Lập trình Căn bản với Python",
      facultyId: new Types.ObjectId("7b8bb20178062966c9ee3fa6"), // Khớp BOOK-LIST-004
      authorIds: [new Types.ObjectId("9d458de4ad9937662b64fbfc")],
      bookType: "TEXTBOOK",
      publisher: "NXB Giáo dục",
      publicationYear: 2023,
      coverPrice: 85000,
      totalCopies: 10,
      availableCopies: 8,
      isAvailableForCirculation: true,
    },
    {
      _id: new Types.ObjectId(),
      title: "Cấu trúc dữ liệu và Giải thuật",
      facultyId: new Types.ObjectId("69cabe960354ac17e1a6b400"),
      authorIds: [new Types.ObjectId("71d33b1a53006cc4aa1644ea")],
      bookType: "TEXTBOOK",
      publisher: "NXB Đại học Quốc gia",
      publicationYear: 2022,
      coverPrice: 95000,
      totalCopies: 15,
      availableCopies: 10,
      isAvailableForCirculation: true,
    },
    {
      _id: new Types.ObjectId(),
      title: "Hệ quản trị cơ sở dữ liệu MongoDB và MySQL",
      facultyId: new Types.ObjectId("0c4323c23034eb5889a9c03f"),
      authorIds: [new Types.ObjectId("813c165b98aa3fd3daf0d1ab")],
      bookType: "TEXTBOOK",
      publisher: "NXB Khoa học Kỹ thuật",
      publicationYear: 2024,
      coverPrice: 110000,
      totalCopies: 12,
      availableCopies: 9,
      isAvailableForCirculation: true,
    },
    {
      _id: new Types.ObjectId(),
      title: "Mạng máy tính và An toàn hệ thống",
      facultyId: new Types.ObjectId("cae0f440bef882ce04faec01"),
      authorIds: [new Types.ObjectId("6315e8ca23f8fe13da831df0")],
      bookType: "REFERENCE",
      publisher: "NXB Thống kê",
      publicationYear: 2023,
      coverPrice: 130000,
      totalCopies: 8,
      availableCopies: 5,
      isAvailableForCirculation: true,
    },
    {
      _id: new Types.ObjectId(),
      title: "Kỹ thuật kiểm thử phần mềm nâng cao",
      facultyId: new Types.ObjectId("c33925d474efccde824a79da"),
      authorIds: [new Types.ObjectId("8c0bce65297777a1b5de668d")],
      bookType: "TEXTBOOK",
      publisher: "NXB Đại học Cần Thơ",
      publicationYear: 2024,
      coverPrice: 105000,
      totalCopies: 25,
      availableCopies: 20,
      isAvailableForCirculation: true,
    },
    {
      _id: new Types.ObjectId(),
      title: "Trí tuệ nhân tạo và Học máy căn bản",
      facultyId: new Types.ObjectId("591bc5c2118feabb6a0f62c2"),
      authorIds: [new Types.ObjectId("667dc742f88fc2272b4ba952")],
      bookType: "REFERENCE",
      publisher: "NXB Khoa học Tự nhiên",
      publicationYear: 2024,
      coverPrice: 160000,
      totalCopies: 10,
      availableCopies: 7,
      isAvailableForCirculation: true,
    },
    {
      _id: new Types.ObjectId(),
      title: "Phân tích và Thiết kế hệ thống thông tin",
      facultyId: new Types.ObjectId("15842463b2c1feac26739bdb"),
      authorIds: [new Types.ObjectId("0923618d06f9869b196be887")],
      bookType: "TEXTBOOK",
      publisher: "NXB Lao động",
      publicationYear: 2023,
      coverPrice: 90000,
      totalCopies: 14,
      availableCopies: 11,
      isAvailableForCirculation: true,
    },
    {
      _id: new Types.ObjectId(),
      title: "Kiến trúc máy tính và Hợp ngữ",
      facultyId: new Types.ObjectId("268faeb7dee782d674af2be2"),
      authorIds: [new Types.ObjectId("9d892f23137ffd7389834d83")],
      bookType: "TEXTBOOK",
      publisher: "NXB Giáo dục",
      publicationYear: 2021,
      coverPrice: 75000,
      totalCopies: 30,
      availableCopies: 25,
      isAvailableForCirculation: true,
    },
    {
      _id: new Types.ObjectId(),
      title: "Lập trình ứng dụng Di động với Flutter",
      facultyId: new Types.ObjectId("1b42a0e928e96ffb5dbffec8"),
      authorIds: [new Types.ObjectId("468e519ef3e4592008cbaf14")],
      bookType: "REFERENCE",
      publisher: "NXB Đại học Quốc gia",
      publicationYear: 2024,
      coverPrice: 140000,
      totalCopies: 16,
      availableCopies: 12,
      isAvailableForCirculation: true,
    },
    {
      _id: new Types.ObjectId(),
      title: "Điện toán đám mây và Microservices",
      facultyId: new Types.ObjectId("bfc6bdd70a209c14c378d702"),
      authorIds: [new Types.ObjectId("cc9dd4bb08637b25b189f838")],
      bookType: "REFERENCE",
      publisher: "NXB Thông tin và Truyền thông",
      publicationYear: 2024,
      coverPrice: 175000,
      totalCopies: 10,
      availableCopies: 6,
      isAvailableForCirculation: true,
    },
    {
      _id: new Types.ObjectId(),
      title: "Nhập môn Khoa học Dữ liệu",
      facultyId: new Types.ObjectId("acdbd60380d4184329ff2669"),
      authorIds: [new Types.ObjectId("c810e386aa7a056bd060d4e3")],
      bookType: "TEXTBOOK",
      publisher: "NXB Cần Thơ",
      publicationYear: 2023,
      coverPrice: 99000,
      totalCopies: 22,
      availableCopies: 18,
      isAvailableForCirculation: true,
    },
  ];

  await BookModel.insertMany(books);
  console.log(`✓ Đã nạp thành công đúng ${books.length} cuốn sách vào DB!`);

  console.log("\n==========================================");
  console.log("HOÀN TẤT SEED DỮ LIỆU QA CHO MODULE BOOKS!");
  console.log("==========================================");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Lỗi khi seed:", err);
  process.exit(1);
});

