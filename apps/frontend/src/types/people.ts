export interface Reader {
  _id: string
  fullName?: string
  dateOfBirth?: string
  phoneNumber?: string
  address?: string
  readerType?: 'STUDENT' | 'POSTGRADUATE' | 'STAFF'
  facultyId: string
  isBorrowingBlocked: boolean
  isBorrowingManuallyBlocked?: boolean
  borrowingBlockReason?: string
}
export interface Employee {
  _id: string
  fullName?: string
  position?: string
  phoneNumber?: string
  address?: string
  permissionIds: string[]
}
export interface Permission { _id: string; permissionName: string; description: string }
export type ReaderInput = Partial<Pick<Reader, 'fullName' | 'dateOfBirth' | 'phoneNumber' | 'address' | 'readerType'>> & { facultyId: string }
export type EmployeeInput = Partial<Pick<Employee, 'fullName' | 'position' | 'phoneNumber' | 'address'>> & { permissionIds: string[] }
export type PermissionInput = Omit<Permission, '_id'>
