import type { AuthUser } from '../services/auth'

export type AppView = 'catalog' | 'dashboard' | 'management' | 'faculty' | 'author' | 'reader' | 'employee' | 'permission' | 'accounts' | 'settings' | 'my-loans' | 'loans' | 'penalties' | 'auth' | 'forbidden'
export const viewPaths: Record<AppView, string> = {
  catalog: 'catalog', dashboard: 'dashboard', management: 'manage', faculty: 'faculty', author: 'author',
  reader: 'reader', employee: 'employee', permission: 'permission', accounts: 'accounts', settings: 'settings', 'my-loans': 'my-loans', loans: 'loans', penalties: 'penalties', auth: 'auth', forbidden: 'forbidden',
}
export const protectedViews: AppView[] = ['dashboard', 'management', 'faculty', 'author', 'reader', 'employee', 'permission', 'accounts', 'settings', 'my-loans', 'loans', 'penalties']
const permissions: Partial<Record<AppView, string>> = {
  dashboard: 'MANAGE_LOANS', management: 'MANAGE_BOOKS', faculty: 'MANAGE_FACULTIES', author: 'MANAGE_AUTHORS', loans: 'MANAGE_LOANS', penalties: 'COLLECT_PENALTY',
}
export const canAccess = (user: AuthUser | null, view: AppView): boolean => {
  if (view === 'forbidden') return user !== null
  if (!protectedViews.includes(view)) return true
  if (!user) return false
  if (view === 'my-loans') return user.role === 'READER'
  if (['reader', 'employee', 'permission', 'accounts', 'settings'].includes(view)) return user.role === 'ADMIN'
  return ['ADMIN', 'EMPLOYEE'].includes(user.role) && !!user.permissions?.includes(permissions[view] || '')
}
export const guardView = (user: AuthUser | null, view: AppView): AppView =>
  canAccess(user, view) ? view : user ? 'forbidden' : 'auth'

const staffHomePriority: AppView[] = ['dashboard', 'management', 'faculty', 'author', 'loans', 'penalties']

export const defaultViewForUser = (user: AuthUser | null): AppView => {
  if (!user) return 'catalog'
  if (user.role === 'READER') return 'my-loans'

  const permittedStaffView = staffHomePriority.find((view) => canAccess(user, view))
  if (permittedStaffView) return permittedStaffView

  if (user.role === 'ADMIN') return 'reader'
  return 'auth'
}

export const brandHomeViewForUser = (user: AuthUser | null): AppView =>
  user && ['EMPLOYEE', 'ADMIN'].includes(user.role) ? defaultViewForUser(user) : 'catalog'

export const viewFromPath = (pathname: string): AppView => {
  const path = pathname.toLowerCase().replace(/^\/|\/$/g, '')
  const aliases: Record<string, AppView> = { management: 'management', faculties: 'faculty', authors: 'author', readers: 'reader', employees: 'employee', permissions: 'permission', login: 'auth', register: 'auth' }
  return (Object.hasOwn(aliases, path) ? aliases[path] : undefined) || (Object.entries(viewPaths).find(([, value]) => value === path)?.[0] as AppView | undefined) || 'catalog'
}
