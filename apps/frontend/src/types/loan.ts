export const LOAN_STATUSES = [
  'Đặt lịch mượn', 'Đang mượn', 'Quá hạn', 'Chờ nộp phạt', 'Đã trả', 'Đã huỷ',
] as const

export type LoanStatus = (typeof LOAN_STATUSES)[number]

export interface LoanRecord {
  _id: string
  readerId: string
  bookId: string
  status: LoanStatus
  reservationDate: string
  reservationExpiryDate: string
  handoverDate?: string
  dueDate?: string
  actualReturnDate?: string
  returnCondition?: string
  handoverEmployeeId?: string
  returnEmployeeId?: string
  isArchived?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface LoanFilters {
  page?: number
  limit?: number
  status?: LoanStatus
  bookId?: string
  readerId?: string
  fromDate?: string
  toDate?: string
}

export interface LoanPage {
  records: LoanRecord[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface PenaltyRecord {
  _id: string
  loanRecordId: string
  overdueFee: number
  damageFee: number
  totalPenalty: number
  paymentStatus: 'Chờ thanh toán' | 'Đã thanh toán'
  paymentDate?: string
}

export interface LoanReturnResult {
  loan: LoanRecord
  penaltyRecord: PenaltyRecord | null
  overdueDays: number
  overdueFee: number
  damageFee: number
  totalPenalty: number
}

export interface LoanPaymentResult {
  loan: LoanRecord
  penalty: PenaltyRecord
  isBorrowingBlocked: boolean
  message: string
}

export const formatLoanDate = (input?: string): string => {
  if (!input) return '—'
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export const loanStatusTone = (status: LoanStatus): string => {
  if (status === 'Đã trả') return 'green'
  if (status === 'Đang mượn') return 'blue'
  if (status === 'Đặt lịch mượn') return 'orange'
  if (status === 'Quá hạn' || status === 'Chờ nộp phạt') return 'red'
  return ''
}

export const isLoanOverdue = (loan: LoanRecord): boolean =>
  loan.status === 'Quá hạn' ||
  (loan.status === 'Đang mượn' && !!loan.dueDate && new Date(loan.dueDate).getTime() < Date.now())
