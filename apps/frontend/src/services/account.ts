import { request } from './request'
import type {
  AccountFilters,
  AccountRow,
  AccountsResult,
  CreateStaffAccountPayload,
} from '../types/account'

export const getAccounts = async (filters: AccountFilters) => {
  const query = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) })
  if (filters.search) query.set('search', filters.search)
  if (filters.role) query.set('role', filters.role)
  if (filters.isActive) query.set('isActive', filters.isActive)
  return request<AccountsResult>(`/account?${query}`)
}

export const createStaffAccount = async (payload: CreateStaffAccountPayload) =>
  request<AccountRow>('/account/staff', 'POST', payload)

export const updateAccount = async (id: string, updates: { email: string; isActive: boolean }) =>
  request<AccountRow>(`/account/${encodeURIComponent(id)}`, 'PATCH', updates)
