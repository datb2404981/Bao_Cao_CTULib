import { describe, it, expect } from 'vitest'
import { brandHomeViewForUser, canAccess, defaultViewForUser, guardView, viewFromHash, protectedViews } from '../middlewares/access'
import type { AuthUser } from '../services/auth'

const user = (role: string, permissions: string[] = []): AuthUser => ({ accountId: '507f1f77bcf86cd799439011', ctuIdentifier: 'CB00001', role, permissions })
describe('middleware điều hướng theo role và quyền', () => {
  it('chặn khách ở màn hình nội bộ; độc giả chỉ xem lịch sử mượn của mình', () => {
    for (const view of protectedViews) {
      expect(guardView(null, view)).toBe('auth')
      expect(guardView(user('READER', ['MANAGE_BOOKS']), view)).toBe(view === 'my-loans' ? 'my-loans' : 'forbidden')
    }
    expect(canAccess(null, 'catalog')).toBe(true)
    expect(canAccess(user('EMPLOYEE', ['MANAGE_LOANS']), 'my-loans')).toBe(false)
    expect(canAccess(user('EMPLOYEE', ['MANAGE_LOANS']), 'loans')).toBe(true)
    expect(canAccess(user('EMPLOYEE', ['MANAGE_LOANS']), 'dashboard')).toBe(true)
    expect(canAccess(user('EMPLOYEE'), 'dashboard')).toBe(false)
    expect(canAccess(user('ADMIN'), 'loans')).toBe(false)
    expect(viewFromHash('#/my-loans')).toBe('my-loans')
    expect(viewFromHash('#/loans')).toBe('loans')
    expect(viewFromHash('#/dashboard')).toBe('dashboard')
  })
  it('không suy ra quyền chức năng từ role ADMIN hoặc EMPLOYEE', () => {
    for (const role of ['ADMIN', 'EMPLOYEE']) {
      expect(canAccess(user(role), 'management')).toBe(false)
      expect(canAccess(user(role, ['MANAGE_BOOKS']), 'management')).toBe(true)
      expect(canAccess(user(role, ['MANAGE_BOOKS']), 'faculty')).toBe(false)
      expect(canAccess(user(role, ['MANAGE_FACULTIES']), 'faculty')).toBe(true)
      expect(canAccess(user(role, ['MANAGE_AUTHORS']), 'author')).toBe(true)
    }
  })
  it('chỉ ADMIN được quản trị hồ sơ và cấp quyền', () => {
    for (const view of ['reader', 'employee', 'permission'] as const) {
      expect(canAccess(user('ADMIN'), view)).toBe(true)
      expect(canAccess(user('EMPLOYEE', ['MANAGE_BOOKS', 'MANAGE_EMPLOYEES']), view)).toBe(false)
      expect(canAccess(user('UNKNOWN'), view)).toBe(false)
    }
  })
  it('nhận liên kết trực tiếp và các đường dẫn số nhiều', () => {
    expect(viewFromHash('#/readers')).toBe('reader')
    expect(viewFromHash('#/employee')).toBe('employee')
    expect(viewFromHash('#/permissions')).toBe('permission')
    expect(viewFromHash('#/management')).toBe('management')
    expect(viewFromHash('#/unknown')).toBe('catalog')
  })

  it('chọn trang mặc định theo role và permission mà không rơi về catalog cho nhân viên', () => {
    expect(defaultViewForUser(null)).toBe('catalog')
    expect(defaultViewForUser(user('READER'))).toBe('my-loans')
    expect(defaultViewForUser(user('EMPLOYEE', ['MANAGE_LOANS']))).toBe('dashboard')
    expect(defaultViewForUser(user('EMPLOYEE', ['MANAGE_BOOKS']))).toBe('management')
    expect(defaultViewForUser(user('EMPLOYEE', ['MANAGE_FACULTIES']))).toBe('faculty')
    expect(defaultViewForUser(user('EMPLOYEE', ['MANAGE_AUTHORS']))).toBe('author')
    expect(defaultViewForUser(user('EMPLOYEE', ['COLLECT_PENALTY']))).toBe('penalties')
    expect(defaultViewForUser(user('EMPLOYEE'))).toBe('auth')
    expect(defaultViewForUser(user('ADMIN'))).toBe('reader')
    expect(brandHomeViewForUser(user('EMPLOYEE', ['MANAGE_BOOKS']))).toBe('management')
    expect(brandHomeViewForUser(user('READER'))).toBe('catalog')
  })
})
