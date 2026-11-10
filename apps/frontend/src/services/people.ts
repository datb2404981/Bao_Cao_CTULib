import { request } from './request'
import type { Reader, ReaderInput, Employee, EmployeeInput, Permission, PermissionInput } from '../types/people'

export const getReaders = async () => request<Reader[]>('/reader')
export const createReader = async (input: ReaderInput & { accountId: string }) => request<Reader>('/reader', 'POST', input)
export const updateReader = async (id: string, input: ReaderInput) => request<Reader>(`/reader/${encodeURIComponent(id)}`, 'PATCH', input)
export const setBorrowingBlock = async (id: string, input: { blocked: boolean; reason: string }) => request<Reader>(`/reader/${encodeURIComponent(id)}/borrowing-block`, 'PATCH', input)
export const getEmployees = async () => request<Employee[]>('/employee')
export const createEmployee = async (input: EmployeeInput & { accountId: string }) => request<Employee>('/employee', 'POST', input)
export const updateEmployee = async (id: string, input: EmployeeInput) => request<Employee>(`/employee/${encodeURIComponent(id)}`, 'PATCH', input)
export const getPermissions = async () => request<Permission[]>('/permission')
export const createPermission = async (input: PermissionInput) => request<Permission>('/permission', 'POST', input)
export const updatePermission = async (id: string, input: PermissionInput) => request<Permission>(`/permission/${encodeURIComponent(id)}`, 'PATCH', input)
