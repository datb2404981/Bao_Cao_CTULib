export type AccountRole = 'READER' | 'EMPLOYEE' | 'ADMIN'

export interface AccountRow {
  _id: string
  ctuIdentifier: string
  email: string
  role: AccountRole
  isActive: boolean
  fullName?: string
  isBorrowingBlocked?: boolean
  isBorrowingManuallyBlocked?: boolean
  createdAt?: string
}

export interface AccountsResult {
  items: AccountRow[]
  meta: { totalItems: number; totalPages: number; currentPage: number; limit: number }
}

export interface AccountFilters {
  page: number
  limit: number
  search?: string
  role?: AccountRole
  isActive?: 'true' | 'false'
}
