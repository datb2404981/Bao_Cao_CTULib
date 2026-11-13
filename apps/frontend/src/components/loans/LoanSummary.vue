<script setup lang="ts">
import type { LoanRecord, PenaltyRecord } from '../../types/loan'
import { formatLoanDate, isLoanOverdue, loanStatusTone } from '../../types/loan'

defineProps<{ loan: LoanRecord; penalty?: PenaltyRecord | null; penaltyLoading?: boolean }>()

const money = (value: number): string => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(value)
</script>

<template>
  <div class="loan-summary">
    <div class="loan-summary-top">
      <div>
        <span class="loan-eyebrow">Chi tiết phiếu mượn</span>
        <h3>{{ loan.bookTitle || 'Phiếu mượn' }}</h3>
      </div>
      <span class="badge" :class="isLoanOverdue(loan) ? 'red' : loanStatusTone(loan.status)">
        {{ isLoanOverdue(loan) ? 'Quá hạn' : loan.status }}
      </span>
    </div>
    <dl class="loan-detail-grid">
      <div><dt>Tên sách</dt><dd>{{ loan.bookTitle || '—' }}</dd></div>
      <div><dt>Mã SV / Cán bộ</dt><dd class="loan-code">{{ loan.readerCode || '—' }}</dd></div>
      <div v-if="loan.readerName"><dt>Họ tên độc giả</dt><dd>{{ loan.readerName }}</dd></div>
      <div><dt>Thời điểm đặt</dt><dd>{{ formatLoanDate(loan.reservationDate) }}</dd></div>
      <div><dt>Hạn giữ chỗ</dt><dd>{{ formatLoanDate(loan.reservationExpiryDate) }}</dd></div>
      <div><dt>Ngày bàn giao</dt><dd>{{ formatLoanDate(loan.handoverDate) }}</dd></div>
      <div><dt>Hạn trả sách</dt><dd :class="{ 'loan-danger': isLoanOverdue(loan) }">{{ formatLoanDate(loan.dueDate) }}</dd></div>
      <div><dt>Ngày nhận trả</dt><dd>{{ formatLoanDate(loan.actualReturnDate) }}</dd></div>
      <div v-if="loan.returnCondition"><dt>Tình trạng lúc trả</dt><dd>{{ loan.returnCondition }}</dd></div>
    </dl>

    <div v-if="penaltyLoading" role="status" class="loan-muted">Đang tải thông tin phí phạt…</div>
    <div v-else-if="penalty" class="loan-penalty-box">
      <div class="loan-section-heading"><strong>Thông tin phí phạt</strong><span class="badge" :class="penalty.paymentStatus === 'Đã thanh toán' ? 'green' : 'red'">{{ penalty.paymentStatus }}</span></div>
      <div class="loan-fee-row"><span>Phí quá hạn</span><strong>{{ money(penalty.overdueFee) }}</strong></div>
      <div class="loan-fee-row"><span>Phí hư hại</span><strong>{{ money(penalty.damageFee) }}</strong></div>
      <div class="loan-fee-row loan-fee-total"><span>Tổng cộng</span><strong>{{ money(penalty.totalPenalty) }}</strong></div>
      <p v-if="penalty.paymentDate" class="loan-muted">Đã thu ngày {{ formatLoanDate(penalty.paymentDate) }}</p>
    </div>
    <p v-else-if="loan.status === 'Chờ nộp phạt'" class="loan-muted">Phiếu đang chờ thu phạt, chưa lấy được thông tin khoản phí.</p>
  </div>
</template>
