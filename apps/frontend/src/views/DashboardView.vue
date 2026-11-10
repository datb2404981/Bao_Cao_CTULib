<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getDashboardStatistics } from '../services/dashboard'
import type { DashboardStatistics } from '../services/dashboard'
import type { AppView } from '../middlewares/access'

const emit = defineEmits<{ navigate: [view: AppView] }>()
const statistics = ref<DashboardStatistics | null>(null)
const loading = ref(false)
const error = ref('')
const number = (value: number): string => new Intl.NumberFormat('vi-VN').format(value)
const money = (value: number): string => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
let requestId = 0

const load = async (): Promise<void> => {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const data = await getDashboardStatistics()
    if (id === requestId) statistics.value = data
  } catch (cause) {
    if (id === requestId) {
      statistics.value = null
      error.value = cause instanceof Error ? cause.message : 'Không thể tải số liệu tổng quan.'
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="container dashboard-workspace">
    <div class="page-head dashboard-heading">
      <div><p class="eyebrow">CTULib / Nghiệp vụ thư viện</p><h1>Tổng quan</h1><p>Theo dõi số liệu hiện tại và những công việc cần xử lý.</p></div>
      <button class="btn" type="button" :disabled="loading" @click="load">{{ loading ? 'Đang cập nhật…' : 'Cập nhật số liệu' }}</button>
    </div>

    <div v-if="error" class="notice error" role="alert">{{ error }} <button class="btn small" type="button" @click="load">Thử lại</button></div>
    <p v-if="loading && !statistics" class="panel dashboard-message" role="status" aria-live="polite">Đang tải số liệu từ hệ thống…</p>

    <template v-if="statistics">
      <div class="dashboard-metrics" aria-label="Chỉ số vận hành hiện tại">
        <div class="dashboard-metric"><span>Bản sách khả dụng</span><strong>{{ number(statistics.books.availableCopies) }}</strong><small>Tổng {{ number(statistics.books.totalCopies) }} bản sách</small></div>
        <div class="dashboard-metric"><span>Đang mượn</span><strong>{{ number(statistics.loans.borrowingCount) }}</strong><small>Phiếu đang lưu hành</small></div>
        <div class="dashboard-metric"><span>Quá hạn</span><strong class="dashboard-alert-number">{{ number(statistics.loans.overdueCount) }}</strong><small>Phiếu cần theo dõi</small></div>
        <div class="dashboard-metric"><span>Chờ nộp phạt</span><strong class="dashboard-alert-number">{{ number(statistics.loans.pendingPenaltyCount) }}</strong><small>Phiếu chưa hoàn tất</small></div>
      </div>

      <section class="panel" aria-labelledby="dashboard-tasks-title">
        <div class="dashboard-section-head"><div><h2 id="dashboard-tasks-title">Cần xử lý</h2><p class="dashboard-secondary">Cập nhật theo dữ liệu thực tế của hệ thống.</p></div><button class="btn primary" type="button" @click="emit('navigate', 'loans')">Xem phiếu mượn</button></div>
        <div class="dashboard-tasks">
          <div><div><strong>Phiếu quá hạn</strong><span>Cần theo dõi và tiếp nhận trả sách</span></div><b>{{ number(statistics.loans.overdueCount) }}</b><button class="btn small" @click="emit('navigate', 'loans')">Xem phiếu</button></div>
          <div><div><strong>Chờ thu tiền phạt</strong><span>Phiếu chờ thanh toán</span></div><b>{{ number(statistics.loans.pendingPenaltyCount) }}</b><button class="btn small" @click="emit('navigate', 'loans')">Xem phiếu</button></div>
          <div><div><strong>Sách hết bản khả dụng</strong><span>Đầu sách cần kiểm tra tồn kho</span></div><b>{{ number(statistics.books.outOfStockCount) }}</b><span class="dashboard-secondary">Theo dõi danh sách bên dưới</span></div>
        </div>
      </section>

      <div class="dashboard-columns">
        <section class="panel" aria-labelledby="dashboard-library-title">
          <h2 id="dashboard-library-title">Kho sách và độc giả</h2>
          <dl class="dashboard-pairs">
            <div><dt>Đầu sách đang lưu hành</dt><dd>{{ number(statistics.books.totalTitles) }}</dd></div>
            <div><dt>Tổng bản sách</dt><dd>{{ number(statistics.books.totalCopies) }}</dd></div>
            <div><dt>Độc giả đã đăng ký</dt><dd>{{ number(statistics.readers.totalReaders) }}</dd></div>
            <div><dt>Đã thu phí phạt</dt><dd>{{ money(statistics.penalties.collectedPenalty) }}</dd></div>
            <div><dt>Phí phạt chưa thu</dt><dd>{{ money(statistics.penalties.unpaidPenalty) }}</dd></div>
          </dl>
        </section>
        <section class="panel" aria-labelledby="dashboard-stock-title">
          <div class="dashboard-section-head"><h2 id="dashboard-stock-title">Cảnh báo tồn kho</h2><span class="dashboard-secondary">Tối đa 10 đầu sách</span></div>
          <p v-if="!statistics.books.outOfStockList.length" class="dashboard-empty">Hiện không có đầu sách hết bản khả dụng.</p>
          <ul v-else class="dashboard-stock-list">
            <li v-for="book in statistics.books.outOfStockList" :key="book._id"><div><strong>{{ book.title }}</strong><span>{{ typeof book.facultyId === 'object' ? book.facultyId?.facultyName || 'Chưa phân khoa' : 'Chưa rõ khoa' }}</span></div><span class="badge red">Hết sách</span></li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard-workspace { display: grid; gap: 22px; min-width: 0; }
.dashboard-heading { margin-bottom: 0; align-items: center; }
.dashboard-metrics { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
.dashboard-metric { display: grid; gap: 8px; min-width: 0; padding: 22px; border: 1px solid var(--line); background: white; border-radius: var(--radius); box-shadow: var(--shadow-sm); }
.dashboard-metric span { color: #475569; font-size: 13px; }
.dashboard-metric strong { font-size: clamp(24px, 3vw, 36px); font-variant-numeric: tabular-nums; line-height: 1.2; color: var(--blue); }
.dashboard-metric .dashboard-alert-number { color: #b91c1c; }
.dashboard-metric small, .dashboard-secondary { color: var(--muted); font-size: 13px; }
.dashboard-section-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.dashboard-section-head h2 { margin: 0; }
.dashboard-section-head p { margin-top: 4px; }
.dashboard-tasks { display: grid; gap: 0; }
.dashboard-tasks > div { display: grid; grid-template-columns: minmax(0,1fr) auto auto; gap: 18px; align-items: center; padding: 14px 0; border-top: 1px solid var(--line); }
.dashboard-tasks strong, .dashboard-tasks span { display: block; }
.dashboard-tasks strong { color: #0f172a; font-size: 14px; }
.dashboard-tasks span { color: var(--muted); font-size: 12px; margin-top: 4px; }
.dashboard-tasks b { font-variant-numeric: tabular-nums; color: #b91c1c; }
.dashboard-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; min-width: 0; }
.dashboard-columns > .panel { min-width: 0; }
.dashboard-columns h2 { margin-bottom: 16px; }
.dashboard-pairs { margin: 0; }
.dashboard-pairs div { display: flex; gap: 12px; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--line); }
.dashboard-pairs div:last-child { border: 0; }
.dashboard-pairs dt { color: #475569; }
.dashboard-pairs dd { margin: 0; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.dashboard-stock-list { padding: 0; margin: 0; list-style: none; }
.dashboard-stock-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
.dashboard-stock-list strong, .dashboard-stock-list span { display: block; overflow-wrap: anywhere; }
.dashboard-stock-list strong { font-size: 14px; }
.dashboard-stock-list span { color: var(--muted); font-size: 12px; }
.dashboard-stock-list .badge { flex: none; color: #b91c1c; }
.dashboard-message, .dashboard-empty { color: var(--muted); padding: 24px; }
@media (max-width: 1000px) { .dashboard-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 750px) { .dashboard-columns { grid-template-columns: 1fr; } .dashboard-heading { align-items: stretch; flex-direction: column; } .dashboard-heading .btn { align-self: flex-start; } }
@media (max-width: 530px) { .dashboard-metrics { grid-template-columns: 1fr 1fr; gap: 8px; } .dashboard-metric { padding: 15px; } .dashboard-metric strong { font-size: 25px; } .dashboard-tasks > div { grid-template-columns: minmax(0,1fr) auto; gap: 8px; } .dashboard-tasks > div .btn, .dashboard-tasks > div > .dashboard-secondary { grid-column: 1 / -1; justify-self: start; } .dashboard-pairs div { font-size: 13px; } }
</style>
