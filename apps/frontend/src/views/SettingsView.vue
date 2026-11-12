<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { request } from '../services/request'

interface SystemConfigItem {
  _id?: string
  key: string
  value: number | string
  description?: string
}

const busy = ref(false)
const message = ref('')
const error = ref('')

const loanDuration = ref<number>(7)
const overdueFeePerDay = ref<number>(5000)
const maxBorrowLimit = ref<number>(3)

async function fetchConfigs() {
  busy.value = true
  error.value = ''
  try {
    const res = await request<SystemConfigItem[]>('/config', 'GET')
    if (Array.isArray(res)) {
      res.forEach(item => {
        if (item.key === 'loanDuration') loanDuration.value = Number(item.value)
        if (item.key === 'overdueFeePerDay') overdueFeePerDay.value = Number(item.value)
        if (item.key === 'maxBorrowLimit') maxBorrowLimit.value = Number(item.value)
      })
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Không thể tải cấu hình hệ thống'
  } finally {
    busy.value = false
  }
}

async function saveConfigs() {
  busy.value = true
  message.value = ''
  error.value = ''
  try {
    const configs = [
      { key: 'loanDuration', value: Number(loanDuration.value) },
      { key: 'overdueFeePerDay', value: Number(overdueFeePerDay.value) },
      { key: 'maxBorrowLimit', value: Number(maxBorrowLimit.value) },
    ]

    for (const cfg of configs) {
      await request(`/config/${cfg.key}`, 'PUT', { value: cfg.value })
    }
    message.value = 'Đã cập nhật các tham số vận hành thành công!'
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Lỗi khi lưu cấu hình.'
  } finally {
    busy.value = false
  }
}

onMounted(fetchConfigs)
</script>

<template>
  <div class="settings-view container">
    <div class="page-head">
      <div>
        <h1 class="page-title">Cấu hình tham số hệ thống</h1>
        <p class="page-subtitle">Quản lý tham số vận hành nghiệp vụ cốt lõi theo học kỳ cho Quản trị viên</p>
      </div>
      <button class="btn primary" :disabled="busy" @click="saveConfigs">
        {{ busy ? 'Đang lưu...' : 'Lưu thay đổi' }}
      </button>
    </div>

    <div v-if="message" class="alert-box success" role="alert">{{ message }}</div>
    <div v-if="error" class="alert-box danger" role="alert">{{ error }}</div>

    <div class="settings-grid">
      <!-- Card: Hạn mức mượn trả -->
      <section class="card config-card" aria-labelledby="loan-rules-heading">
        <div class="card-header">
          <div class="card-icon blue">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
          <div>
            <h2 id="loan-rules-heading" class="card-title">Quy định Mượn & Giữ chỗ</h2>
            <p class="card-desc">Thời hạn và số lượng tài liệu độc giả được phép mượn</p>
          </div>
        </div>

        <div class="form-group">
          <label for="loanDuration">Thời hạn mượn mặc định (ngày)</label>
          <div class="input-suffix-wrapper">
            <input id="loanDuration" v-model.number="loanDuration" type="number" min="1" max="90" required />
            <span class="suffix">ngày</span>
          </div>
          <small class="field-hint">Số ngày tính từ khi thủ thư bấm bàn giao sách cho độc giả.</small>
        </div>

        <div class="form-group">
          <label for="maxBorrowLimit">Số sách mượn tối đa / độc giả</label>
          <div class="input-suffix-wrapper">
            <input id="maxBorrowLimit" v-model.number="maxBorrowLimit" type="number" min="1" max="10" required />
            <span class="suffix">cuốn</span>
          </div>
          <small class="field-hint">Tổng số lượng sách đang giữ chỗ + đang mượn cùng một thời điểm.</small>
        </div>
      </section>

      <!-- Card: Phí phạt vi phạm -->
      <section class="card config-card" aria-labelledby="penalty-rules-heading">
        <div class="card-header">
          <div class="card-icon orange">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          </div>
          <div>
            <h2 id="penalty-rules-heading" class="card-title">Chế tài & Đơn giá Phạt</h2>
            <p class="card-desc">Mức thu phạt tài chính khi trả trễ hoặc vi phạm nội quy</p>
          </div>
        </div>

        <div class="form-group">
          <label for="overdueFeePerDay">Đơn giá phạt quá hạn (VNĐ / ngày)</label>
          <div class="input-suffix-wrapper">
            <input id="overdueFeePerDay" v-model.number="overdueFeePerDay" type="number" min="1000" step="1000" required />
            <span class="suffix">VNĐ/ngày</span>
          </div>
          <small class="field-hint">Tính lũy tiến cho mỗi ngày trễ hạn sau ngày hẹn trả sách.</small>
        </div>

        <div class="policy-callout">
          <strong>Lưu ý về phạt bồi thường hư hại sách:</strong>
          <p>Mức bồi thường được hệ thống tự động tính theo tỷ lệ phần trăm (%) nhân với <em>Giá bìa niêm yết</em> của đầu sách khi thủ thư tiếp nhận trả sách.</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-view { padding: 24px 0; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; }
.page-title { font-size: 24px; font-weight: 700; color: #1e293b; margin: 0 0 6px; }
.page-subtitle { color: #64748b; font-size: 14px; margin: 0; }

.settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 24px; }
.config-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
.card-header { display: flex; gap: 14px; margin-bottom: 20px; align-items: center; }
.card-icon { width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
.card-icon.blue { background: #eff6ff; color: #2563eb; }
.card-icon.orange { background: #fff7ed; color: #ea580c; }
.card-title { font-size: 17px; font-weight: 600; color: #0f172a; margin: 0 0 4px; }
.card-desc { font-size: 13px; color: #64748b; margin: 0; }

.form-group { margin-bottom: 18px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; }
.input-suffix-wrapper { position: relative; display: flex; align-items: center; }
.input-suffix-wrapper input { width: 100%; height: 42px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 80px 0 14px; font-size: 15px; font-weight: 500; }
.input-suffix-wrapper input:focus { outline: none; border-color: var(--color-focus); box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.14); }
.input-suffix-wrapper .suffix { position: absolute; right: 12px; font-size: 13px; color: #94a3b8; font-weight: 500; pointer-events: none; }
.field-hint { display: block; margin-top: 5px; font-size: 12px; color: #64748b; }

.policy-callout { background: #f8fafc; border-left: 3px solid #3b82f6; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #475569; margin-top: 14px; }
.policy-callout p { margin: 4px 0 0; }

.alert-box { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
.alert-box.success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.alert-box.danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

@media (max-width: 480px) {
  .settings-view { padding: 16px 0 28px; }
  .settings-grid { gap: 14px; }
  .config-card { padding: 16px; }
}
</style>
