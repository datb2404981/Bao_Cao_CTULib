<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import LoanSummary from '../components/loans/LoanSummary.vue'
import { cancelLoan, getLoanPenalty, getMyLoans } from '../services/loan'
import { LOAN_STATUSES, formatLoanDate, isLoanOverdue, loanStatusTone } from '../types/loan'
import type { LoanPage, LoanRecord, LoanStatus, PenaltyRecord } from '../types/loan'

const page = ref(1)
const status = ref<LoanStatus | ''>('')
const result = ref<LoanPage | null>(null)
const loading = ref(false)
const processing = ref(false)
const error = ref('')
const message = ref('')
const selected = ref<LoanRecord | null>(null)
const penalty = ref<PenaltyRecord | null>(null)
const penaltyLoading = ref(false)
const cancelConfirm = ref(false)
let requestVersion = 0
let penaltyVersion = 0

const records = computed(() => result.value?.records ?? [])
const totalPages = computed(() => result.value?.pagination.totalPages ?? 0)
const pendingCount = computed(() => records.value.filter(row => row.status === 'Đặt lịch mượn').length)
const borrowingCount = computed(() => records.value.filter(row => row.status === 'Đang mượn' || row.status === 'Quá hạn').length)

const load = async (afterMutation = false): Promise<void> => {
  if (processing.value && !afterMutation) return
  const version = ++requestVersion
  loading.value = true
  error.value = ''
  try {
    const data = await getMyLoans({ page: page.value, limit: 10, ...(status.value ? { status: status.value } : {}) })
    if (version !== requestVersion) return
    result.value = data
    if (selected.value) selected.value = data.records.find(row => row._id === selected.value?._id) ?? null
  } catch (cause) {
    if (version === requestVersion) {
      error.value = cause instanceof Error ? cause.message : 'Không thể tải lịch sử mượn sách.'
      result.value = null
    }
  } finally { if (version === requestVersion) loading.value = false }
}

const openDetail = async (loan: LoanRecord): Promise<void> => {
  if (processing.value || loading.value) return
  selected.value = loan
  cancelConfirm.value = false
  penalty.value = null
  const version = ++penaltyVersion
  penaltyLoading.value = true
  try {
    const data = await getLoanPenalty(loan._id)
    if (version === penaltyVersion) penalty.value = data
  } catch (cause) {
    if (version === penaltyVersion) error.value = cause instanceof Error ? cause.message : 'Không thể tải phiếu phạt.'
  } finally { if (version === penaltyVersion) penaltyLoading.value = false }
}

const confirmCancel = async (): Promise<void> => {
  if (processing.value || !selected.value || selected.value.status !== 'Đặt lịch mượn') return
  const loanId = selected.value._id
  processing.value = true
  error.value = ''
  message.value = ''
  try {
    await cancelLoan(loanId)
    resetDetail()
    message.value = 'Đã hủy đặt giữ chỗ. Số bản khả dụng sẽ được cập nhật trong kho sách.'
    await load(true)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không thể hủy phiếu.' }
  finally { processing.value = false }
}

const resetDetail = (): void => {
  ++penaltyVersion
  selected.value = null
  penalty.value = null
  penaltyLoading.value = false
  cancelConfirm.value = false
}

const closeDetail = (): void => {
  if (processing.value) return
  resetDetail()
}

const changePage = (direction: number): void => {
  if (loading.value || processing.value || page.value + direction < 1 || page.value + direction > totalPages.value) return
  page.value += direction
  closeDetail()
  void load()
}

watch(status, () => {
  if (processing.value) return
  page.value = 1
  closeDetail()
  void load()
})
onMounted(() => { void load() })
</script>

<template>
  <div class="container loan-workspace">
    <div class="page-head loan-heading">
      <div><span class="loan-eyebrow">CTULib / Dành cho độc giả</span><h1>Phiếu mượn của tôi</h1><p>Theo dõi giữ chỗ, hạn trả và tình trạng từng phiếu mượn.</p></div>
      <button type="button" class="btn" :disabled="loading || processing" @click="load()">Làm mới</button>
    </div>

    <div class="loan-metrics" aria-label="Tóm tắt các phiếu trên trang hiện tại">
      <div class="loan-metric"><span>Tổng phiếu phù hợp</span><strong>{{ result?.pagination.total ?? '—' }}</strong></div>
      <div class="loan-metric"><span>Giữ chỗ trên trang</span><strong>{{ pendingCount }}</strong></div>
      <div class="loan-metric"><span>Đang mượn trên trang</span><strong>{{ borrowingCount }}</strong></div>
    </div>

    <div v-if="message" class="notice success loan-notice" role="status">{{ message }}</div>
    <div v-if="error" class="notice error loan-notice" role="alert">{{ error }} <button class="btn small" type="button" :disabled="loading || processing" @click="load()">Thử lại</button></div>

    <section class="panel loan-panel" aria-labelledby="my-loans-title">
      <div class="loan-section-heading"><h2 id="my-loans-title">Danh sách phiếu mượn</h2><label class="loan-inline-filter">Trạng thái
        <select v-model="status" :disabled="loading || processing"><option value="">Tất cả trạng thái</option><option v-for="item in LOAN_STATUSES" :key="item" :value="item">{{ item }}</option></select>
      </label></div>
      <p v-if="loading" role="status" class="loan-placeholder">Đang tải danh sách phiếu…</p>
      <p v-else-if="!result" class="loan-placeholder" role="status">Không thể hiển thị danh sách phiếu mượn. Hãy thử tải lại.</p>
      <p v-else-if="!records.length" class="loan-placeholder">Chưa có phiếu mượn phù hợp với bộ lọc.</p>
      <div v-else class="loan-table-wrap"><table class="loan-table"><thead><tr><th>Phiếu mượn</th><th>Ấn phẩm</th><th>Ngày đặt</th><th>Hạn giữ / trả</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody><tr v-for="loan in records" :key="loan._id">
          <td data-label="Phiếu mượn"><strong>#{{ loan._id.slice(-8).toUpperCase() }}</strong></td>
          <td data-label="Mã sách" class="loan-code">{{ loan.bookId }}</td>
          <td data-label="Ngày đặt">{{ formatLoanDate(loan.reservationDate) }}</td>
          <td data-label="Hạn giữ / trả">{{ formatLoanDate(loan.dueDate || loan.reservationExpiryDate) }}</td>
          <td data-label="Trạng thái"><span class="badge" :class="isLoanOverdue(loan) ? 'red' : loanStatusTone(loan.status)">{{ isLoanOverdue(loan) ? 'Quá hạn' : loan.status }}</span></td>
          <td data-label="Thao tác"><button type="button" class="btn small" :disabled="loading || processing" @click="openDetail(loan)">Chi tiết</button></td>
        </tr></tbody></table></div>
      <div v-if="result && totalPages > 1" class="loan-pagination"><span>Trang {{ page }}/{{ totalPages }} · {{ result.pagination.total }} phiếu</span><div><button type="button" class="btn small" :disabled="loading || processing || page <= 1" @click="changePage(-1)">Trước</button><button type="button" class="btn small" :disabled="loading || processing || page >= totalPages" @click="changePage(1)">Sau</button></div></div>
    </section>

    <section v-if="selected" class="panel loan-panel loan-detail" aria-label="Chi tiết phiếu đã chọn">
      <LoanSummary :loan="selected" :penalty="penalty" :penalty-loading="penaltyLoading" />
      <div class="loan-actions">
        <button v-if="selected.status === 'Đặt lịch mượn' && !cancelConfirm" type="button" class="btn danger" :disabled="processing" @click="cancelConfirm = true">Hủy đặt giữ chỗ</button>
        <button type="button" class="btn" :disabled="processing" @click="closeDetail()">Đóng chi tiết</button>
      </div>
      <div v-if="cancelConfirm" class="loan-confirm-box">
        <p>Bạn chắc chắn muốn hủy phiếu này? Thao tác sẽ trả một bản sách về kho khả dụng.</p>
        <div class="loan-actions"><button type="button" class="btn danger" :disabled="processing" @click="confirmCancel">{{ processing ? 'Đang hủy…' : 'Xác nhận hủy phiếu' }}</button><button type="button" class="btn" :disabled="processing" @click="cancelConfirm = false">Giữ phiếu</button></div>
      </div>
    </section>
  </div>
</template>
