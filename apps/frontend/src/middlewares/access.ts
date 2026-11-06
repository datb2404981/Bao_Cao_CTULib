import type { AuthUser } from '../services/auth'

export type AppView = 'catalog' | 'management' | 'faculty' | 'author' | 'reader' | 'employee' | 'permission' | 'auth' | 'forbidden'
export const viewPaths: Record<AppView, string> = {
  catalog: 'catalog', management: 'manage', faculty: 'faculty', author: 'author',
  reader: 'reader', employee: 'employee', permission: 'permission', auth: 'auth', forbidden: 'forbidden',
}
export const protectedViews: AppView[] = ['management', 'faculty', 'author', 'reader', 'employee', 'permission']
const permissions: Partial<Record<AppView, string>> = {
  management: 'MANAGE_BOOKS', faculty: 'MANAGE_FACULTIES', author: 'MANAGE_AUTHORS',
}
export const canAccess = (user: AuthUser | null, view: AppView): boolean => {
  if (!protectedViews.includes(view)) return true
  if (!user) return false
  if (['reader', 'employee', 'permission'].includes(view)) return user.role === 'ADMIN'
  return ['ADMIN', 'EMPLOYEE'].includes(user.role) && !!user.permissions?.includes(permissions[view] || '')
}
export const guardView = (user: AuthUser | null, view: AppView): AppView =>
  canAccess(user, view) ? view : user ? 'forbidden' : 'auth'
export const viewFromHash = (hash: string): AppView => {
  const path = hash.toLowerCase().replace(/^#\//, '')
  const aliases: Record<string, AppView> = { management: 'management', faculties: 'faculty', authors: 'author', readers: 'reader', employees: 'employee', permissions: 'permission', login: 'auth', register: 'auth' }
  return aliases[path] || (Object.entries(viewPaths).find(([, value]) => value === path)?.[0] as AppView | undefined) || 'catalog'
}
