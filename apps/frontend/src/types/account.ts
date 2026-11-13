export type AccountRole = 'READER' | 'EMPLOYEE' | 'ADMIN'
export type AccountRoleFilter = AccountRole | 'STAFF'

export interface AccountRow {
  _id: string
  ctuIdentifier: string
  email: string
  role: AccountRole
  isActive: boolean
  fullName?: string
  position?: string
  permissionIds?: string[]
  isBorrowingBlocked?: boolean
  isBorrowingManuallyBlocked?: boolean
  createdAt?: string
}

export interface CreateStaffAccountPayload {
  ctuIdentifier: string
  email: string
  password: string
  role: 'EMPLOYEE' | 'ADMIN'
  fullName: string
  position?: string
  phoneNumber?: string
  address?: string
  permissionIds: string[]
}

export interface AccountsResult {
  items: AccountRow[]
  meta: { totalItems: number; totalPages: number; currentPage: number; limit: number }
}

export interface AccountFilters {
  page: number
  limit: number
  search?: string
  role?: AccountRoleFilter
  isActive?: 'true' | 'false'
}
