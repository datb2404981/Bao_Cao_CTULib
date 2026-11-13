<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { collectPenalty, getPenalties, getPenaltyDetail } from '../services/penalty'
import { formatLoanDate } from '../types/loan'
import type { PenaltyDetail, PenaltyPage } from '../types/penalty'

const money = (amount: number): string => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(amount)
const draft = reactive({ paymentStatus: '' as '' | 'PENDING' | 'PAID', readerCode: '', bookTitle: '' })
const filters = reactive({ paymentStatus: '' as '' | 'PENDING' | 'PAID', readerCode: '', bookTitle: '' })
const page = ref(1)
const response = ref<PenaltyPage | null>(null)
const selected = ref<PenaltyDetail | null>(null)
const loading = ref(false)
const detailLoading = ref(false)
const processing = ref(false)
const error = ref('')
const detailError = ref('')
const message = ref('')
const confirming = ref(false)
const acknowledged = ref(false)
let listRequestId = 0
let detailRequestId = 0

const items = computed(() => response.value?.items ?? [])
const totalPages = computed(() => response.value?.meta.totalPages ?? 0)

const load = async (preservePaidReceipt = false): Promise<void> => {
  if (processing.value && !preservePaidReceipt) return
  const id = ++listRequestId
  loading.value = true
  error.value = ''
  try {
    const data = await getPenalties({
      page: page.value, limit: 10,
      ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
      ...(filters.readerCode ? { readerCode: filters.readerCode } : {}),
      ...(filters.bookTitle ? { bookTitle: filters.bookTitle } : {}),
    })
    if (id !== listRequestId) return
    response.value = data
    if (selected.value && !(preservePaidReceipt && selected.value.paymentStatus === 'PAID') && !data.items.some(item => item.penaltyId === selected.value?.penaltyId)) {
      selected.value = null
      confirming.value = false
      detailRequestId++
    }
  } catch (cause) {
    if (id !== listRequestId) return
    response.value = null
    error.value = cause instanceof Error ? cause.message : 'Không thể tải phiếu phạt.'
  } finally { if (id === listRequestId) loading.value = false }
}

const applyFilters = (): void => {
  if (loading.value || processing.value) return
  Object.assign(filters, {
    paymentStatus: draft.paymentStatus,
    readerCode: draft.readerCode.trim(),
    bookTitle: draft.bookTitle.trim(),
  })
  page.value = 1
  selected.value = null
  confirming.value = false
  detailRequestId++
  detailLoading.value = false
  detailError.value = ''
  void load()
}

const clearFilters = (): void => {
  if (loading.value || processing.value) return
  Object.assign(draft, { paymentStatus: '', readerCode: '', bookTitle: '' })
  applyFilters()
}

const selectPenalty = async (item: PenaltyDetail): Promise<void> => {
  if (loading.value || processing.value) return
  const id = ++detailRequestId
  selected.value = null
  confirming.value = false
  acknowledged.value = false
  detailError.value = ''
  detailLoading.value = true
  try {
    const data = await getPenaltyDetail(item.penaltyId)
    if (id === detailRequestId) selected.value = data
  } catch (cause) {
    if (id === detailRequestId) detailError.value = cause instanceof Error ? cause.message : 'Không thể tải chi tiết phiếu phạt.'
  } finally { if (id === detailRequestId) detailLoading.value = false }
}

const closeDetail = (): void => {
  if (processing.value) return
  detailRequestId++
  selected.value = null
  detailLoading.value = false
  detailError.value = ''
  confirming.value = false
}

const changePage = (delta: number): void => {
  if (loading.value || processing.value || page.value + delta < 1 || page.value + delta > totalPages.value) return
  page.value += delta
  closeDetail()
  void load()
}

const confirmPayment = async (): Promise<void> => {
  if (!selected.value || selected.value.paymentStatus !== 'PENDING' || !confirming.value || !acknowledged.value || processing.value) return
  const penaltyId = selected.value.penaltyId
  const amount = selected.value.totalPenalty
  processing.value = true
  detailError.value = ''
  message.value = ''
  try {
    const result = await collectPenalty(penaltyId, amount)
    selected.value = result.penalty
    confirming.value = false
    acknowledged.value = false
    message.value = result.isBorrowingBlocked
      ? 'Đã ghi nhận thu tiền. Độc giả vẫn bị chặn mượn do còn vi phạm khác.'
      : 'Đã ghi nhận thu đủ tiền và cập nhật tình trạng phiếu phạt.'
    await load(true)
  } catch (cause) {
    detailError.value = cause instanceof Error ? cause.message : 'Không thể xác nhận thu tiền phạt.'
  } finally { processing.value = false }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="container loan-workspace penalty-workspace">
    <div class="page-head loan-heading">
      <div><span class="loan-eyebrow">CTULib / Nghiệp vụ thủ thư</span><h1>Quản lý phiếu phạt</h1><p>Tra cứu phí vi phạm và ghi nhận thu tiền trực tiếp tại quầy.</p></div>
      <button type="button" class="btn" :disabled="loading || processing" @click="load()">Làm mới</button>
    </div>
    <form class="panel loan-filter-panel" aria-label="Bộ lọc phiếu phạt" @submit.prevent="applyFilters">
      <div class="loan-section-heading"><h2>Lọc phiếu phạt</h2><button type="button" class="btn small" :disabled="loading || processing" @click="clearFilters">Xóa bộ lọc</button></div>
      <div class="loan-filter-grid">
        <label class="loan-field">Thanh toán
          <select v-model="draft.paymentStatus" :disabled="loading || processing"><option value="">Tất cả trạng thái</option><option value="PENDING">Chờ thanh toán</option><option value="PAID">Đã thanh toán</option></select>
        </label>
        <label class="loan-field">Mã sinh viên / cán bộ
          <input v-model="draft.readerCode" type="text" maxlength="64" :disabled="loading || processing" placeholder="Nhập mã SV / CB..." autocomplete="off" />
        </label>
        <label class="loan-field">Tên sách
          <input v-model="draft.bookTitle" type="text" maxlength="200" :disabled="loading || processing" placeholder="Nhập tên sách..." autocomplete="off" />
        </label>
      </div>
      <div class="loan-actions"><button type="submit" class="btn primary" :disabled="loading || processing">Áp dụng bộ lọc</button></div>
    </form>

    <div v-if="message" class="notice success loan-notice" role="status">{{ message }}</div>
    <div v-if="error" class="notice error loan-notice" role="alert">{{ error }} <button v-if="!response" type="button" class="btn small" :disabled="loading || processing" @click="load()">Thử lại</button></div>
    <section class="panel loan-panel" aria-labelledby="penalty-list-title">
      <div class="loan-section-heading"><h2 id="penalty-list-title">Danh sách phiếu phạt</h2><span v-if="response" class="loan-muted">{{ response.meta.totalItems }} phiếu phù hợp</span></div>
      <p v-if="loading" class="loan-placeholder" role="status">Đang tải phiếu phạt…</p>
      <p v-else-if="!response" class="loan-placeholder" role="status">Chưa tải được danh sách phiếu phạt.</p>
      <p v-else-if="!items.length" class="loan-placeholder">Không có phiếu phạt phù hợp với bộ lọc hiện tại.</p>
      <div v-else class="loan-table-wrap"><table class="loan-table">
        <thead><tr><th scope="col">Phiếu phạt</th><th scope="col">Mã SV / Cán bộ</th><th scope="col">Tên sách</th><th scope="col">Ngày lập</th><th scope="col">Tổng tiền</th><th scope="col">Thanh toán</th><th scope="col">Thao tác</th></tr></thead>
        <tbody><tr v-for="item in items" :key="item.penaltyId">
          <td data-label="Phiếu phạt"><strong>#{{ item.penaltyId.slice(-8).toUpperCase() }}</strong></td>
          <td data-label="Mã SV / Cán bộ" class="loan-code">{{ item.readerCode || '—' }}</td>
          <td data-label="Tên sách">{{ item.bookTitle || '—' }}</td>
          <td data-label="Ngày lập">{{ formatLoanDate(item.issuedDate) }}</td>
          <td data-label="Tổng tiền"><strong>{{ money(item.totalPenalty) }}</strong></td>
          <td data-label="Thanh toán"><span class="badge" :class="item.paymentStatus === 'PAID' ? 'green' : 'orange'">{{ item.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán' }}</span></td>
          <td data-label="Thao tác"><button type="button" class="btn small" :disabled="loading || processing" :aria-label="`Xem phiếu phạt ${item.penaltyId.slice(-8)}`" @click="selectPenalty(item)">Chi tiết</button></td>
        </tr></tbody>
      </table></div>
      <div v-if="response && totalPages > 1" class="loan-pagination">
        <span>Trang {{ page }}/{{ totalPages }}</span><div><button type="button" class="btn small" :disabled="loading || processing || page <= 1" @click="changePage(-1)">Trước</button><button type="button" class="btn small" :disabled="loading || processing || page >= totalPages" @click="changePage(1)">Sau</button></div>
      </div>
    </section>

    <p v-if="detailLoading" class="loan-placeholder" role="status">Đang tải chi tiết phiếu phạt…</p>
    <div v-if="detailError" class="notice error" role="alert">{{ detailError }}</div>
    <section v-if="selected" class="panel loan-panel loan-detail" aria-labelledby="penalty-detail-title">
      <div class="loan-section-heading"><h2 id="penalty-detail-title">Chi tiết phiếu phạt #{{ selected.penaltyId.slice(-8).toUpperCase() }}</h2><button type="button" class="btn small" :disabled="processing" @click="closeDetail">Đóng</button></div>
      <dl class="loan-detail-grid">
        <div><dt>Tên sách</dt><dd>{{ selected.bookTitle || '—' }}</dd></div>
        <div><dt>Mã SV / Cán bộ</dt><dd class="loan-code">{{ selected.readerCode || '—' }}</dd></div>
        <div v-if="selected.readerName"><dt>Họ tên độc giả</dt><dd>{{ selected.readerName }}</dd></div>
        <div><dt>Ngày lập phiếu</dt><dd>{{ formatLoanDate(selected.issuedDate) }}</dd></div>
        <div><dt>Số ngày quá hạn</dt><dd>{{ selected.overdueDays }} ngày</dd></div>
        <div><dt>Tỷ lệ hư hại</dt><dd>{{ selected.damagePercentage }}%</dd></div>
        <div><dt>Giá bìa áp dụng</dt><dd>{{ money(selected.appliedCoverPrice) }}</dd></div>
        <div><dt>Trạng thái</dt><dd>{{ selected.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán' }}</dd></div>
        <div v-if="selected.paymentDate"><dt>Thời điểm thanh toán</dt><dd>{{ formatLoanDate(selected.paymentDate) }}</dd></div>
        <div v-if="selected.collectorCode"><dt>Nhân viên thu</dt><dd class="loan-code">{{ selected.collectorCode }}</dd></div>
      </dl>
      <div v-if="selected.violationNote" class="loan-penalty-box"><strong>Ghi chú vi phạm</strong><p>{{ selected.violationNote }}</p></div>
      <div class="loan-penalty-box">
        <div class="loan-fee-row"><span>Phí quá hạn</span><strong>{{ money(selected.overdueFee) }}</strong></div>
        <div class="loan-fee-row"><span>Phí hư hại / mất sách</span><strong>{{ money(selected.damageFee) }}</strong></div>
        <div class="loan-fee-row loan-fee-total"><span>Tổng tiền phạt</span><strong>{{ money(selected.totalPenalty) }}</strong></div>
        <div v-if="selected.paymentStatus === 'PAID'" class="loan-fee-row"><span>Đã thu</span><strong>{{ money(selected.amountCollected) }}</strong></div>
      </div>
      <div v-if="selected.paymentStatus === 'PENDING' && !confirming" class="loan-actions"><button type="button" class="btn primary" :disabled="processing" @click="confirming = true; acknowledged = false">Xác nhận thu tiền</button></div>
      <form v-if="selected.paymentStatus === 'PENDING' && confirming" class="loan-confirm-box" @submit.prevent="confirmPayment">
        <h3>Xác nhận đã nhận đủ tiền mặt</h3>
        <p>Số tiền cần thu: <strong class="loan-danger">{{ money(selected.totalPenalty) }}</strong>. Hãy kiểm tra số tiền thực nhận trước khi ghi nhận thanh toán.</p>
        <label class="loan-check"><input v-model="acknowledged" type="checkbox" :disabled="processing" />Tôi đã nhận đủ số tiền mặt nêu trên.</label>
        <div class="loan-actions"><button type="submit" class="btn primary" :disabled="processing || !acknowledged || selected.totalPenalty <= 0">{{ processing ? 'Đang ghi nhận…' : 'Xác nhận đã thu đủ' }}</button><button type="button" class="btn" :disabled="processing" @click="confirming = false; acknowledged = false">Quay lại</button></div>
      </form>
    </section>
  </div>
</template>
