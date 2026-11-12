import "dotenv/config";
import mongoose from "mongoose";
import authorModel from "../models/author.model.js";
import BookModel from "../models/book.model.js";
import facultyModel from "../models/faculty.model.js";

const facultyCodeMap = {
  "Trường Nông nghiệp": "CTU-COA",
  "Trường Công nghệ Thông tin và Truyền thông": "CTU-CICT",
  "Khoa Môi trường và Tài nguyên Thiên nhiên": "CTU-CENRES",
  "Khoa Khoa học Xã hội và Nhân văn": "CTU-CSSH",
  "Trường Sư phạm": "CTU-COE",
  "Khoa Khoa học Tự nhiên": "CTU-CNS",
  "Trường Thủy sản": "CTU-COF",
  "Trường Kinh tế": "CTU-COECO",
  "Viện Công nghệ Sinh học và Thực phẩm": "CTU-IBFT",
  "Trường Bách khoa": "CTU-COET",
  "Trường Ngoại ngữ": "CTU-CFL",
} as const;

type FacultyName = keyof typeof facultyCodeMap;

type SeedBook = {
  title: string;
  facultyName: FacultyName;
  authors: readonly string[];
  bookType: "TEXTBOOK" | "REFERENCE";
  coverPrice: number;
  totalCopies: number;
};

const publisher = "Nhà xuất bản Đại học Cần Thơ";

const books: readonly SeedBook[] = [
  { title: "Giáo trình Kỹ thuật sản xuất rau sạch", facultyName: "Trường Nông nghiệp", authors: ["Võ Thị Bích Thủy", "Trần Thị Ba"], bookType: "TEXTBOOK", coverPrice: 90000, totalCopies: 12 },
  { title: "Giáo trình Điện toán đám mây", facultyName: "Trường Công nghệ Thông tin và Truyền thông", authors: ["Ngô Bá Hùng", "Triệu Thanh Ngoan", "Thái Minh Tuấn"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Đánh giá tác động môi trường", facultyName: "Khoa Môi trường và Tài nguyên Thiên nhiên", authors: ["Nguyễn Văn Công", "Nguyễn Thanh Giao", "Nguyễn Võ Châu Ngân"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 8 },
  { title: "Giáo trình Cơ sở văn hóa Việt Nam", facultyName: "Khoa Khoa học Xã hội và Nhân văn", authors: ["Nguyễn Thị Hồng Hạnh", "Tạ Đức Tú", "Trần Thị Nâu", "Phạm Tuấn Ánh", "Nguyễn Hải Yến", "Hồ Thị Xuân Quỳnh", "Trương Thị Kim Thủy", "Thạch Chanh Đa"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 8 },
  { title: "Giáo trình Công nghệ thức ăn vật nuôi", facultyName: "Trường Nông nghiệp", authors: ["Nguyễn Trọng Ngữ", "Nguyễn Thị Hồng Nhân", "Nguyễn Thiết", "Nguyễn Thị Ngọc Linh", "Lê Thanh Phương"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Bản đồ du lịch", facultyName: "Khoa Khoa học Xã hội và Nhân văn", authors: ["Đào Ngọc Cảnh", "Huỳnh Văn Đà"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 8 },
  { title: "Giáo trình Giải tích hàm một biến", facultyName: "Trường Sư phạm", authors: ["Nguyễn Thư Hương", "Nguyễn Trung Kiên"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 12 },
  { title: "Giáo trình Lí luận dạy học Tự nhiên – Xã hội", facultyName: "Trường Sư phạm", authors: ["Dương Huy Cẩn", "Đỗ Thị Như Uyên", "Huỳnh Thái Lộc", "Huỳnh Thị Trúc Giang", "Trần Thị Kim Thúy"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 8 },
  { title: "Thực tập vật lý đại cương", facultyName: "Khoa Khoa học Tự nhiên", authors: ["Nguyễn Văn Hợp", "Nguyễn Thị Kim Chi", "Đặng Long Quân", "Trần Thị Ngọc Thảo", "Nguyễn Thị Kim Ngân", "Phạm Thị Bích Thảo", "Nguyễn Thị Hồng"], bookType: "REFERENCE", coverPrice: 0, totalCopies: 10 },
  { title: "Thực tập hệ thống nhúng", facultyName: "Trường Công nghệ Thông tin và Truyền thông", authors: ["Trương Phong Tuyên", "Nguyễn Cao Quí", "Nguyễn Văn Mướt", "Nguyễn Văn Khanh"], bookType: "REFERENCE", coverPrice: 0, totalCopies: 10 },
  { title: "Thống kê đa biến ứng dụng trong nuôi trồng thủy sản (Applied Multivariate Statistics in Aquaculture)", facultyName: "Trường Thủy sản", authors: ["Võ Nam Sơn", "Nguyễn Thanh Phương"], bookType: "REFERENCE", coverPrice: 0, totalCopies: 8 },
  { title: "Cơ sở cải thiện năng suất và chất lượng cây ăn trái ở Đồng bằng sông Cửu Long", facultyName: "Trường Nông nghiệp", authors: ["Lê Văn Hòa", "Nguyễn Bảo Vệ"], bookType: "REFERENCE", coverPrice: 0, totalCopies: 8 },
  { title: "Tài nguyên nước Đồng bằng sông Cửu Long: Hiện trạng và giải pháp sử dụng bền vững", facultyName: "Khoa Môi trường và Tài nguyên Thiên nhiên", authors: ["Trần Văn Tỷ", "Trần Minh Thuận", "Lê Anh Tuấn"], bookType: "REFERENCE", coverPrice: 0, totalCopies: 8 },
  { title: "Phát triển kinh tế Đồng bằng sông Cửu Long: Thành tựu và Thách thức", facultyName: "Trường Kinh tế", authors: ["Võ Thành Danh"], bookType: "REFERENCE", coverPrice: 0, totalCopies: 8 },
  { title: "Nghiên cứu và ứng dụng công nghệ thông tin ở Đồng bằng sông Cửu Long", facultyName: "Trường Công nghệ Thông tin và Truyền thông", authors: ["Trần Cao Đệ"], bookType: "REFERENCE", coverPrice: 0, totalCopies: 8 },
  { title: "Kỹ Thuật sau thu hoạch (bảo quản và chế biến) một số loại nông sản ở Đồng bằng sông Cửu Long", facultyName: "Trường Nông nghiệp", authors: ["Nguyễn Minh Thủy"], bookType: "REFERENCE", coverPrice: 0, totalCopies: 8 },
  { title: "Nuôi cá tra (Pangasianodon hypophthalmus) ở đồng bằng sông Cửu Long: Thành công và thách thức trong phát triển bền vững", facultyName: "Trường Thủy sản", authors: ["Nguyễn Thanh Phương", "Nguyễn Anh Tuấn"], bookType: "REFERENCE", coverPrice: 0, totalCopies: 8 },
  { title: "Nghiên cứu ứng dụng công nghệ sinh học tại trường Đại học Cần Thơ", facultyName: "Viện Công nghệ Sinh học và Thực phẩm", authors: ["Trần Nhân Dũng", "Nguyễn Văn Thành"], bookType: "REFERENCE", coverPrice: 0, totalCopies: 8 },
  { title: "Giáo trình Thương mại điện tử", facultyName: "Trường Công nghệ Thông tin và Truyền thông", authors: ["Trương Quốc Định", "Nguyễn Thái Nghe", "Nguyễn Thanh Hải", "Trần Thanh Điện", "Sử Kim Anh"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Thủy công", facultyName: "Trường Bách khoa", authors: ["Trần Văn Tỷ", "Trần Văn Hừng", "Cù Ngọc Thắng"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Vật liệu vô cơ", facultyName: "Trường Bách khoa", authors: ["Nguyễn Văn Hưng", "Bùi Thị Minh Nguyệt", "Bùi Văn Thắng", "Nguyễn Hữu Nghị", "Nguyễn Ngọc Bích", "Đặng Thị Thu Liễu"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 8 },
  { title: "Giáo trình Trắc địa", facultyName: "Trường Bách khoa", authors: ["Trần Vũ An", "Nguyễn Phước Công", "Trần Hoàng Tuấn"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Ứng dụng công nghệ thông tin cơ bản", facultyName: "Trường Công nghệ Thông tin và Truyền thông", authors: ["Huỳnh Thanh Nhã", "Nguyễn Bá Duy"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 12 },
  { title: "Giáo trình Kinh tế công cộng", facultyName: "Trường Kinh tế", authors: ["Nguyễn Tuấn Kiệt", "Nguyễn Xuân Vinh", "Quách Dương Tử"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Kỹ năng viết học thuật 2 (Advanced writing skills II) (Tái bản lần thứ hai)", facultyName: "Trường Ngoại ngữ", authors: ["Nguyễn Bửu Huân", "Hồ Phương Thùy", "Nguyễn Thị Nguyên Tuyết"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Thực vật dược (Tái bản lần thứ nhất)", facultyName: "Trường Nông nghiệp", authors: ["Trương Thị Đẹp", "Đỗ Văn Mãi", "Trì Kim Ngọc", "Dương Thanh Khiết"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 8 },
  { title: "Giáo trình Tiếng Anh du lịch (Tái bản lần thứ nhất)", facultyName: "Trường Ngoại ngữ", authors: ["Đặng Thị Bảo Dung"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Tài chính doanh nghiệp (Tái bản lần thứ nhất, có sửa chữa và bổ sung)", facultyName: "Trường Kinh tế", authors: ["Trương Diễm Kiều", "Huỳnh Thị Cẩm Bình", "Nguyễn Thị Thanh Nhàn", "Nguyễn Thị Kim Thoa", "Bùi Kim Tiền"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Thuế (Tái bản lần thứ nhất, có sửa chữa và bổ sung)", facultyName: "Trường Kinh tế", authors: ["Trương Đông Lộc", "Nguyễn Thị Kim Phượng", "Đoàn Thị Cẩm Vân", "Mai Lê Trúc Liên", "Khưu Thị Phương Đông"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Nguyên lý kế toán (Tái bản lần thứ nhất, có sửa chữa và bổ sung)", facultyName: "Trường Kinh tế", authors: ["Nguyễn Minh Tiến", "Hồ Thị Khánh Thành"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 12 },
  { title: "Giáo trình Phân tích Chi phí – Lợi ích", facultyName: "Trường Kinh tế", authors: ["Lê Cảnh Dũng", "Võ Văn Tuấn", "Võ Thành Danh"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 8 },
  { title: "Giáo trình Sử dụng thí nghiệm trong dạy học Vật lí", facultyName: "Trường Sư phạm", authors: ["Nguyễn Hoàng Anh", "Quách Nguyễn Bảo Nguyên", "Phan Thị Thùy Linh"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 8 },
  { title: "Giáo trình Tạo mẫu nhanh", facultyName: "Trường Bách khoa", authors: ["Nguyễn Văn Cương", "Đặng Văn Nghìn"], bookType: "TEXTBOOK", coverPrice: 90000, totalCopies: 8 },
  { title: "Giáo trình Tin học căn bản", facultyName: "Trường Công nghệ Thông tin và Truyền thông", authors: ["Đặng Quốc Bảo", "Nguyễn Thị Ngọc Chi", "Nguyễn Thị Mỹ Dung", "Nguyễn Thị Như Quyến", "Nguyễn Thị Thanh Thảo"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 12 },
  { title: "Giáo trình Cơ học kết cấu", facultyName: "Trường Bách khoa", authors: ["Đặng Thế Gia", "Nguyễn Anh Duy", "Lê Tuấn Tú"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Cơ học 1", facultyName: "Trường Bách khoa", authors: ["Lê Thị Ngọc Tú", "Phạm Thị Mỹ Hạnh", "Hà Thái Thủy", "Lê Phạm Thiết Trường", "Trần Thị Thanh Thư"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 12 },
  { title: "Giáo trình Cơ sở dữ liệu", facultyName: "Trường Công nghệ Thông tin và Truyền thông", authors: ["Đặng Quốc Bảo", "Lê Minh Thư", "Lê Anh Tuấn", "Nguyễn Thị Mỹ Dung", "Nguyễn Thị Thanh Thảo"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 12 },
  { title: "Giáo trình Điều khiển mờ", facultyName: "Trường Bách khoa", authors: ["Nguyễn Chí Ngôn", "Nguyễn Chánh Nghiệm"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 8 },
  { title: "Giáo trình Hóa phân tích đại cương", facultyName: "Khoa Khoa học Tự nhiên", authors: ["Lâm Phước Điền", "Ngô Kim Liên", "Phạm Quốc Nhiên", "Nguyễn Trọng Tuân"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Kinh doanh quốc tế (Tái bản lần thứ nhất, có sửa chữa và bổ sung)", facultyName: "Trường Kinh tế", authors: ["Võ Văn Dứt", "Phan Anh Tú", "Trương Khánh Vĩnh Xuyên", "Đinh Thị Lệ Trinh", "Phạm Lê Đông Hậu"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
  { title: "Giáo trình Lý luận dạy học hiện đại", facultyName: "Trường Sư phạm", authors: ["Bùi Thị Mùi", "Phạm Phương Tâm", "Trần Lương"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 8 },
  { title: "Giáo trình Nấm ăn", facultyName: "Trường Nông nghiệp", authors: ["Lê Vĩnh Thúc", "Bùi Thị Cẩm Hường"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 8 },
  { title: "Giáo trình Nguyên lý hệ quản trị cơ sở dữ liệu", facultyName: "Trường Công nghệ Thông tin và Truyền thông", authors: ["Trần Công Án", "Phạm Thế Phi", "Nguyễn Thanh Hải", "Thái Minh Tuấn"], bookType: "TEXTBOOK", coverPrice: 0, totalCopies: 10 },
];

const authorCodeMap = new Map(
  [...new Set(books.flatMap((book) => book.authors))].map((fullName, index) => [
    fullName,
    `TG-CTU-${String(index + 1).padStart(3, "0")}`,
  ]),
);

const main = async (): Promise<void> => {
  if (!process.env.MONGODB_URI) throw new Error("Thiếu cấu hình kết nối database.");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  let inserted = 0;
  let existing = 0;
  for (const item of books) {
    const facultyCode = facultyCodeMap[item.facultyName];
    const faculty = await facultyModel.findOneAndUpdate(
      { facultyName: item.facultyName },
      {
        $set: { facultyCode },
        $setOnInsert: {
          facultyName: item.facultyName,
          description: `Đơn vị học thuật thuộc Đại học Cần Thơ`,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    const authorIds = [];
    for (const fullName of item.authors) {
      const authorCode = authorCodeMap.get(fullName);
      if (!authorCode) throw new Error(`Không tạo được mã tác giả cho ${fullName}.`);
      const author = await authorModel.findOneAndUpdate(
        { fullName },
        {
          $set: { authorCode },
          $setOnInsert: { fullName, affiliation: "Đại học Cần Thơ" },
        },
        { upsert: true, new: true, runValidators: true },
      );
      authorIds.push(author._id);
    }

    const existingBook = await BookModel.exists({ title: item.title, publisher });
    if (existingBook) {
      existing += 1;
      continue;
    }

    await BookModel.create({
      title: item.title,
      publisher,
      facultyId: faculty._id,
      authorIds,
      bookType: item.bookType,
      coverPrice: item.coverPrice,
      totalCopies: item.totalCopies,
      availableCopies: item.totalCopies,
      isAvailableForCirculation: true,
    });
    inserted += 1;
  }

  console.log(`Production books seed hoàn tất: ${inserted} sách mới, ${existing} sách đã tồn tại.`);
  console.log(`Tổng số đầu sách CTU trong bộ seed: ${books.length}.`);
};

try { await main(); }
catch (error) {
  console.error(error instanceof Error ? error.message : "Seed production thất bại.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
