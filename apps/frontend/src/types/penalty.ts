export interface PenaltyDetail {
  penaltyId: string
  loanId: string
  readerAccountId: string
  issuedDate: string
  overdueDays: number
  appliedCoverPrice: number
  damagePercentage: number
  overdueFee: number
  damageFee: number
  totalPenalty: number
  violationNote: string | null
  paymentStatus: 'PENDING' | 'PAID'
  paymentDate: string | null
  collectorAccountId: string | null
  amountCollected: number
  paymentMethod: string | null
}

export interface PenaltyPage {
  items: PenaltyDetail[]
  meta: { totalItems: number; totalPages: number; currentPage: number; limit: number }
}

export interface PenaltyFilters {
  page?: number
  limit?: number
  paymentStatus?: PenaltyDetail['paymentStatus']
  loanId?: string
  readerAccountId?: string
}

export interface PenaltyCollectionResult {
  penalty: PenaltyDetail
  loan: { loanId: string; status: string }
  isBorrowingBlocked: boolean
}
