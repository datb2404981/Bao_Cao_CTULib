import { request } from './request'

export interface OutOfStockBook {
  _id: string
  title: string
  bookType?: string
  totalCopies: number
  availableCopies: number
  facultyId?: { _id: string; facultyName: string } | string | null
}

export interface DashboardStatistics {
  books: {
    totalTitles: number
    totalCopies: number
    availableCopies: number
    outOfStockCount: number
    outOfStockList: OutOfStockBook[]
  }
  readers: { totalReaders: number }
  loans: { borrowingCount: number; overdueCount: number; pendingPenaltyCount: number }
  penalties: { unpaidPenalty: number; collectedPenalty: number; totalRevenue: number }
}

export const getDashboardStatistics = (): Promise<DashboardStatistics> =>
  request<DashboardStatistics>('/api/v1/dashboard/stats')
