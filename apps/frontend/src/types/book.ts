/**
 * apps/frontend/src/types/book.ts
 * Type definitions matching backend models and API contracts.
 * Strictly compliant with "erasableSyntaxOnly: true".
 */

export type BookType = 'TEXTBOOK' | 'REFERENCE';

export interface Book {
  bookId: string;
  title: string;
  bookType: BookType;
  facultyId: string;
  authorIds: string[];
  totalCopies: number;
  availableCopies: number;
  coverPrice: number;
  publicationYear?: number;
  publisher?: string;
  coverImageUrl?: string;
  isAvailableForCirculation: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  facultyId?: string;
  bookType?: BookType;
}

export interface PaginationMeta {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface PaginatedBooksResult {
  items: Book[];
  meta: PaginationMeta;
}

export interface CreateBookPayload {
  title: string;
  facultyId: string;
  authorIds: string[];
  bookType?: BookType;
  totalCopies: number;
  coverPrice: number;
  publicationYear?: number;
  publisher?: string;
  coverImageUrl?: string;
  isAvailableForCirculation?: boolean;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message: string;
  data: T;
}

export interface ValidationErrorItem {
  field: string;
  message: string;
}

export class BookApiError extends Error {
  status: number;
  fields: Record<string, string>;
  data?: unknown;

  constructor(message: string, status: number, fields: Record<string, string> = {}, data?: unknown) {
    super(message);
    this.name = 'BookApiError';
    this.status = status;
    this.fields = fields;
    this.data = data;
  }
}

/**
 * Danh mục tham chiếu Khoa/Viện và Tác giả (Seed data matching backend seed-books-qa.ts)
 */
export interface FacultyRef {
  facultyId: string;
  facultyName: string;
}

export interface AuthorRef {
  authorId: string;
  fullName: string;
  affiliation?: string;
}

export const FACULTIES: readonly FacultyRef[] = [
  { facultyId: '69cabe960354ac17e1a6b400', facultyName: 'Khoa Công nghệ Thông tin & Truyền thông' },
  { facultyId: 'ee584419975de7543b8c2fd2', facultyName: 'Khoa Kỹ thuật Phần mềm' },
  { facultyId: '7b8bb20178062966c9ee3fa6', facultyName: 'Khoa Khoa học Máy tính' },
  { facultyId: '0c4323c23034eb5889a9c03f', facultyName: 'Khoa Hệ thống Thông tin' },
  { facultyId: 'cae0f440bef882ce04faec01', facultyName: 'Khoa Mạng Máy tính' },
  { facultyId: 'c33925d474efccde824a79da', facultyName: 'Khoa An toàn Thông tin' },
  { facultyId: '15842463b2c1feac26739bdb', facultyName: 'Khoa Khoa học Dữ liệu' },
  { facultyId: '591bc5c2118feabb6a0f62c2', facultyName: 'Khoa Trí tuệ Nhân tạo' },
  { facultyId: '268faeb7dee782d674af2be2', facultyName: 'Khoa Công nghệ Đa phương tiện' },
  { facultyId: '1b42a0e928e96ffb5dbffec8', facultyName: 'Khoa Điện tử Viễn thông' },
  { facultyId: 'bfc6bdd70a209c14c378d702', facultyName: 'Khoa Tự động hóa' },
  { facultyId: 'acdbd60380d4184329ff2669', facultyName: 'Khoa Cơ điện tử' },
  { facultyId: '2f4d9cfb1e1f495d1a54c5c9', facultyName: 'Khoa Kinh tế' },
  { facultyId: '14ab370efea1b5d9c4d51986', facultyName: 'Khoa Luật' },
  { facultyId: '4e02fedd178b2a630abf4a5f', facultyName: 'Khoa Sư phạm' },
];

export const AUTHORS: readonly AuthorRef[] = [
  { authorId: '3028c4b741766ed91a3b43ac', fullName: 'Tác giả kiểm thử một', affiliation: 'ĐH Cần Thơ' },
  { authorId: '9d458de4ad9937662b64fbfc', fullName: 'Nguyễn Văn A', affiliation: 'ĐH Cần Thơ' },
  { authorId: '71d33b1a53006cc4aa1644ea', fullName: 'Trần Thị B', affiliation: 'ĐH Cần Thơ' },
  { authorId: '813c165b98aa3fd3daf0d1ab', fullName: 'Lê Văn C', affiliation: 'ĐH Bách Khoa' },
  { authorId: '6315e8ca23f8fe13da831df0', fullName: 'Phạm Văn D', affiliation: 'ĐH Cần Thơ' },
  { authorId: '8c0bce65297777a1b5de668d', fullName: 'Hoàng Thị E', affiliation: 'ĐH Cần Thơ' },
  { authorId: '667dc742f88fc2272b4ba952', fullName: 'Đỗ Văn F', affiliation: 'ĐH Cần Thơ' },
  { authorId: '0923618d06f9869b196be887', fullName: 'Vũ Thị G', affiliation: 'ĐH Cần Thơ' },
  { authorId: '9d892f23137ffd7389834d83', fullName: 'Bùi Văn H', affiliation: 'ĐH Quốc Gia' },
  { authorId: '468e519ef3e4592008cbaf14', fullName: 'Đặng Thị I', affiliation: 'ĐH Cần Thơ' },
  { authorId: 'cc9dd4bb08637b25b189f838', fullName: 'Hồ Văn K', affiliation: 'ĐH Cần Thơ' },
  { authorId: 'c810e386aa7a056bd060d4e3', fullName: 'Dương Thị L', affiliation: 'ĐH Cần Thơ' },
  { authorId: 'dcea843597642c0636dd2387', fullName: 'Ngô Văn M', affiliation: 'ĐH Cần Thơ' },
  { authorId: '6e0848f5b6dd17ee3af24a72', fullName: 'Lý Thị N', affiliation: 'ĐH Cần Thơ' },
  { authorId: '56b5ed21b18144492b4d7019', fullName: 'Mai Văn P', affiliation: 'ĐH Cần Thơ' },
];

export function getFacultyName(facultyId: string): string {
  const match = FACULTIES.find((f) => f.facultyId === facultyId);
  return match ? match.facultyName : facultyId;
}

export function getAuthorNames(authorIds: string[]): string {
  if (!authorIds || authorIds.length === 0) return 'Chưa cập nhật';
  const names = authorIds.map((id) => {
    const match = AUTHORS.find((a) => a.authorId === id);
    return match ? match.fullName : id;
  });
  return names.join(', ');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đồng';
}
