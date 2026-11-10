<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import LoanSummary from '../components/loans/LoanSummary.vue'
import { cancelLoan, collectLoanPenalty, getAllLoans, getLoanPenalty, handoverLoan, returnLoan } from '../services/loan'
import { LOAN_STATUSES, formatLoanDate, isLoanOverdue, loanStatusTone } from '../types/loan'
import type { LoanPage, LoanRecord, LoanStatus, PenaltyRecord } from '../types/loan'

type StaffAction = 'handover' | 'cancel' | 'return' | 'payment'
const money = (value: number): string => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(value)

const draft = reactive({ status: '' as LoanStatus | '', readerId: '', bookId: '', fromDate: '', toDate: '' })
const filters = reactive({ status: '' as LoanStatus | '', readerId: '', bookId: '', fromDate: '', toDate: '' })
const page = ref(1)
const result = ref<LoanPage | null>(null)
const selected = ref<LoanRecord | null>(null)
const penalty = ref<PenaltyRecord | null>(null)
const penaltyLoading = ref(false)
const loading = ref(false)
const processing = ref(false)
const error = ref('')
const message = ref('')
const action = ref<StaffAction | null>(null)
const acknowledged = ref(false)
const damagePercentage = ref(0)
const returnCondition = ref('')
let requestVersion = 0
let penaltyVersion = 0

const records = computed(() => result.value?.records ?? [])
const totalPages = computed(() => result.value?.pagination.totalPages ?? 0)
const canSubmitReturn = computed(() => Number.isInteger(damagePercentage.value) && damagePercentage.value >= 0 && damagePercentage.value <= 100)

const load = async (): Promise<void> => {
  const version = ++requestVersion
  loading.value = true
  error.value = ''
  try {
    const data = await getAllLoans({
      page: page.value, limit: 10,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.readerId ? { readerId: filters.readerId } : {}),
      ...(filters.bookId ? { bookId: filters.bookId } : {}),
      ...(filters.fromDate ? { fromDate: new Date(`${filters.fromDate}T00:00:00`).toISOString() } : {}),
      ...(filters.toDate ? { toDate: new Date(`${filters.toDate}T23:59:59.999`).toISOString() } : {}),
    })
    if (version !== requestVersion) return
    result.value = data
    if (selected.value) selected.value = data.records.find(item => item._id === selected.value?._id) ?? null
  } catch (cause) {
    if (version === requestVersion) {
      error.value = cause instanceof Error ? cause.message : 'Không thể tải phiếu mượn.'
      result.value = null
    }
  } finally { if (version === requestVersion) loading.value = false }
}

const applyFilters = (): void => {
  if (processing.value) return
  const idRegex = /^[0-9a-fA-F]{24}$/
  if ((draft.readerId.trim() && !idRegex.test(draft.readerId.trim())) || (draft.bookId.trim() && !idRegex.test(draft.bookId.trim()))) {
    error.value = 'Mã độc giả và mã sách phải là ObjectId gồm 24 ký tự hex.'
    return
  }
  if (draft.fromDate && draft.toDate && draft.fromDate > draft.toDate) {
    error.value = 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
    return
  }
  Object.assign(filters, { ...draft, readerId: draft.readerId.trim(), bookId: draft.bookId.trim() })
  page.value = 1
  selected.value = null
  penaltyVersion++
  penalty.value = null
  penaltyLoading.value = false
  action.value = null
  void load()
}

const clearFilters = (): void => {
  if (processing.value) return
  Object.assign(draft, { status: '', readerId: '', bookId: '', fromDate: '', toDate: '' })
  applyFilters()
}

const loadPenalty = async (loanId: string): Promise<void> => {
  const version = ++penaltyVersion
  penalty.value = null
  penaltyLoading.value = true
  try {
    const data = await getLoanPenalty(loanId)
    if (version === penaltyVersion) penalty.value = data
  } catch (cause) {
    if (version === penaltyVersion) error.value = cause instanceof Error ? cause.message : 'Không thể tra cứu tiền phạt.'
  } finally { if (version === penaltyVersion) penaltyLoading.value = false }
}

const selectLoan = (loan: LoanRecord): void => {
  if (processing.value) return
  selected.value = loan
  action.value = null
  acknowledged.value = false
  damagePercentage.value = 0
  returnCondition.value = ''
  void loadPenalty(loan._id)
}

const chooseAction = (next: StaffAction): void => {
  action.value = next
  acknowledged.value = false
}

const performAction = async (): Promise<void> => {
  if (processing.value || !selected.value || !action.value || !acknowledged.value) return
  if (action.value === 'return' && !canSubmitReturn.value) return
  if (action.value === 'payment' && (penalty.value?.paymentStatus !== 'Chờ thanh toán')) return
  const id = selected.value._id
  const currentAction = action.value
  processing.value = true
  error.value = ''
  message.value = ''
  try {
    if (currentAction === 'handover') {
      await handoverLoan(id)
      message.value = 'Đã xác nhận bàn giao sách. Hạn trả đã được thiết lập.'
    } else if (currentAction === 'cancel') {
      await cancelLoan(id)
      message.value = 'Đã hủy phiếu và hoàn trả một bản khả dụng.'
    } else if (currentAction === 'return') {
      const returned = await returnLoan(id, {
        damagePercentage: damagePercentage.value,
        ...(returnCondition.value.trim() ? { returnCondition: returnCondition.value.trim() } : {}),
      })
      penalty.value = returned.penaltyRecord
      message.value = `Đã tiếp nhận trả sách. Phí trễ: ${money(returned.overdueFee)}; phí hư hại: ${money(returned.damageFee)}; tổng: ${money(returned.totalPenalty)}.`
    } else {
      const paid = await collectLoanPenalty(id)
      penalty.value = paid.penalty
      message.value = paid.isBorrowingBlocked
        ? 'Đã ghi nhận thanh toán. Tài khoản vẫn bị khóa vì còn phiếu vi phạm khác.'
        : 'Đã ghi nhận thanh toán và kiểm tra điều kiện mở khóa độc giả.'
    }
    action.value = null
    acknowledged.value = false
    await load()
    if (selected.value) await loadPenalty(id)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không thể xử lý phiếu mượn.'
  } finally { processing.value = false }
}

const changePage = (direction: number): void => {
  if (processing.value || loading.value) return
  page.value = Math.max(1, page.value + direction)
  selected.value = null
  penaltyVersion++
  penalty.value = null
  penaltyLoading.value = false
  action.value = null
  void load()
}

onMounted(() => { void load() })
</script>

<template>
  <div class="container loan-workspace">
    <div class="page-head loan-heading">
      <div><span class="loan-eyebrow">CTULib / Nghiệp vụ thủ thư</span><h1>Quản lý mượn – trả</h1><p>Duyệt bàn giao, tiếp nhận sách và xác nhận thu phí trên từng phiếu.</p></div>
      <button type="button" class="btn" :disabled="loading || processing" @click="load">Làm mới</button>
    </div>

    <div v-if="message" class="notice success loan-notice" role="status">{{ message }}</div>
    <div v-if="error" class="notice error loan-notice" role="alert">{{ error }}</div>

    <form class="panel loan-filter-panel" aria-label="Bộ lọc phiếu mượn" @submit.prevent="applyFilters">
      <div class="loan-section-heading"><h2>Lọc phiếu mượn</h2><button type="button" class="btn quiet small" :disabled="processing" @click="clearFilters">Đặt lại</button></div>
      <div class="loan-filter-grid">
        <label class="loan-field">Trạng thái<select v-model="draft.status" :disabled="processing"><option value="">Tất cả</option><option v-for="item in LOAN_STATUSES" :key="item" :value="item">{{ item }}</option></select></label>
        <label class="loan-field">Mã độc giả<input v-model="draft.readerId" type="text" placeholder="24 ký tự ObjectId" maxlength="24" :disabled="processing" /></label>
        <label class="loan-field">Mã sách<input v-model="draft.bookId" type="text" placeholder="24 ký tự ObjectId" maxlength="24" :disabled="processing" /></label>
        <label class="loan-field">Từ ngày<input v-model="draft.fromDate" type="date" :disabled="processing" /></label>
        <label class="loan-field">Đến ngày<input v-model="draft.toDate" type="date" :disabled="processing" /></label>
        <button type="submit" class="btn primary" :disabled="loading || processing">Áp dụng lọc</button>
      </div>
    </form>

    <section class="panel loan-panel" aria-labelledby="staff-loans-title">
      <div class="loan-section-heading"><h2 id="staff-loans-title">Danh sách phiếu</h2><span class="loan-muted">{{ result?.pagination.total ?? '—' }} phiếu</span></div>
      <p v-if="loading" class="loan-placeholder" role="status">Đang tải danh sách phiếu…</p>
      <p v-else-if="!result" class="loan-placeholder" role="status">Không thể hiển thị danh sách phiếu mượn. Hãy thử tải lại.</p>
      <p v-else-if="!records.length" class="loan-placeholder">Không tìm thấy phiếu mượn nào với điều kiện lọc.</p>
      <div v-else class="loan-table-wrap"><table class="loan-table"><thead><tr><th>Phiếu</th><th>Độc giả</th><th>Mã sách</th><th>Ngày đặt</th><th>Hạn giữ / trả</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody><tr v-for="loan in records" :key="loan._id">
          <td data-label="Phiếu"><strong>#{{ loan._id.slice(-8).toUpperCase() }}</strong></td>
          <td data-label="Độc giả" class="loan-code">{{ loan.readerId }}</td>
          <td data-label="Mã sách" class="loan-code">{{ loan.bookId }}</td>
          <td data-label="Ngày đặt">{{ formatLoanDate(loan.reservationDate) }}</td>
          <td data-label="Hạn giữ / trả">{{ formatLoanDate(loan.dueDate || loan.reservationExpiryDate) }}</td>
          <td data-label="Trạng thái"><span class="badge" :class="isLoanOverdue(loan) ? 'red' : loanStatusTone(loan.status)">{{ isLoanOverdue(loan) ? 'Quá hạn' : loan.status }}</span></td>
          <td data-label="Thao tác"><button type="button" class="btn small" :disabled="processing" @click="selectLoan(loan)">Xử lý</button></td>
        </tr></tbody></table></div>
      <div v-if="result && totalPages > 1" class="loan-pagination"><span>Trang {{ page }}/{{ totalPages }}</span><div><button type="button" class="btn small" :disabled="loading || processing || page <= 1" @click="changePage(-1)">Trước</button><button type="button" class="btn small" :disabled="loading || processing || page >= totalPages" @click="changePage(1)">Sau</button></div></div>
    </section>

    <section v-if="selected" class="panel loan-panel loan-detail" aria-label="Xử lý phiếu đã chọn">
      <LoanSummary :loan="selected" :penalty="penalty" :penalty-loading="penaltyLoading" />
      <div class="loan-actions">
        <button v-if="selected.status === 'Đặt lịch mượn'" type="button" class="btn primary" :disabled="processing || new Date(selected.reservationExpiryDate).getTime() <= Date.now()" @click="chooseAction('handover')">Xác nhận bàn giao</button>
        <button v-if="selected.status === 'Đặt lịch mượn'" type="button" class="btn danger" :disabled="processing" @click="chooseAction('cancel')">Hủy giữ chỗ</button>
        <button v-if="selected.status === 'Đang mượn' || selected.status === 'Quá hạn'" type="button" class="btn primary" :disabled="processing" @click="chooseAction('return')">Tiếp nhận trả</button>
        <button v-if="selected.status === 'Chờ nộp phạt'" type="button" class="btn primary" :disabled="processing || penaltyLoading || penalty?.paymentStatus !== 'Chờ thanh toán'" @click="chooseAction('payment')">Xác nhận thu tiền</button>
        <button type="button" class="btn" :disabled="processing" @click="selected = null; action = null">Đóng chi tiết</button>
      </div>

      <form v-if="action" class="loan-confirm-box" @submit.prevent="performAction">
        <h3>{{ action === 'handover' ? 'Xác nhận giao sách' : action === 'cancel' ? 'Xác nhận hủy phiếu' : action === 'return' ? 'Tiếp nhận trả sách' : 'Xác nhận đã thu tiền phạt' }}</h3>
        <p v-if="action === 'handover'">Đã kiểm tra phiếu và sách thực tế tại quầy. Hạn mượn sẽ được tính khi bàn giao.</p>
        <p v-else-if="action === 'cancel'">Phiếu đặt giữ chỗ sẽ bị hủy và một bản sách được hoàn kho.</p>
        <template v-else-if="action === 'return'">
          <div class="loan-form-grid"><label class="loan-field">Tỷ lệ hư hại (%)<input v-model.number="damagePercentage" type="number" min="0" max="100" step="1" required /></label><label class="loan-field">Tình trạng sách khi trả<input v-model="returnCondition" type="text" maxlength="300" placeholder="Bỏ trống để hệ thống tự ghi nhận" /></label></div>
          <p class="loan-muted">Hệ thống sẽ tính phí quá hạn và hư hại dựa trên ngày nhận trả thực tế và giá bìa sách.</p>
          <p v-if="!canSubmitReturn" class="loan-danger">Tỷ lệ hư hại phải nằm trong khoảng từ 0 đến 100.</p>
        </template>
        <template v-else>
          <p v-if="penalty">Số tiền phải thu: <strong class="loan-danger">{{ money(penalty.totalPenalty) }}</strong>. Chỉ xác nhận sau khi thực sự nhận đủ tiền.</p>
          <p v-else class="loan-danger">Chưa có thông tin tiền phạt. Cần tải lại phiếu trước khi thu.</p>
        </template>
        <label class="loan-check"><input v-model="acknowledged" type="checkbox" />{{ action === 'payment' ? 'Tôi xác nhận đã nhận đủ số tiền nêu trên.' : 'Tôi đã kiểm tra và xác nhận thao tác này.' }}</label>
        <div class="loan-actions"><button type="submit" class="btn primary" :disabled="processing || !acknowledged || (action === 'return' && !canSubmitReturn) || (action === 'payment' && penalty?.paymentStatus !== 'Chờ thanh toán')">{{ processing ? 'Đang xử lý…' : 'Xác nhận thực hiện' }}</button><button type="button" class="btn" :disabled="processing" @click="action = null">Quay lại</button></div>
      </form>
    </section>
  </div>
</template>
