import { request } from './request'
import type { PenaltyCollectionResult, PenaltyDetail, PenaltyFilters, PenaltyPage } from '../types/penalty'

const base = '/api/v1/penalties'

export const getPenalties = (filters: PenaltyFilters = {}): Promise<PenaltyPage> => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return request<PenaltyPage>(query ? `${base}?${query}` : base)
}

export const getPenaltyDetail = (penaltyId: string): Promise<PenaltyDetail> =>
  request<PenaltyDetail>(`${base}/${encodeURIComponent(penaltyId)}`)

export const collectPenalty = (penaltyId: string, expectedTotalPenalty: number): Promise<PenaltyCollectionResult> =>
  request<PenaltyCollectionResult>(`${base}/${encodeURIComponent(penaltyId)}/collect`, 'PATCH', {
    confirmFullCashReceived: true,
    expectedTotalPenalty,
  })
