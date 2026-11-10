import { request } from './request'
import type { LoanFilters, LoanPage, LoanPaymentResult, LoanRecord, LoanReturnResult, PenaltyRecord } from '../types/loan'

const base = '/api/v1/loans'

const withQuery = (path: string, options: LoanFilters): string => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export const getMyLoans = (params: Omit<LoanFilters, 'readerId'> = {}): Promise<LoanPage> =>
  request<LoanPage>(withQuery(`${base}/me`, params))

export const getAllLoans = (params: LoanFilters = {}): Promise<LoanPage> =>
  request<LoanPage>(withQuery(base, params))

export const reserveBook = (bookId: string): Promise<LoanRecord> =>
  request<LoanRecord>(base, 'POST', { bookId })

export const cancelLoan = (loanId: string): Promise<LoanRecord> =>
  request<LoanRecord>(`${base}/${encodeURIComponent(loanId)}/cancel`, 'PATCH')

export const handoverLoan = (loanId: string): Promise<LoanRecord> =>
  request<LoanRecord>(`${base}/${encodeURIComponent(loanId)}/handover`, 'PATCH')

export const returnLoan = (
  loanId: string,
  input: { damagePercentage: number; returnCondition?: string },
): Promise<LoanReturnResult> =>
  request<LoanReturnResult>(`${base}/${encodeURIComponent(loanId)}/return`, 'PATCH', input)

export const collectLoanPenalty = (loanId: string): Promise<LoanPaymentResult> =>
  request<LoanPaymentResult>(`${base}/${encodeURIComponent(loanId)}/penalty/payment`, 'PATCH')

export const getLoanPenalty = (loanId: string): Promise<PenaltyRecord | null> =>
  request<PenaltyRecord | null>(`${base}/${encodeURIComponent(loanId)}/penalty`)
