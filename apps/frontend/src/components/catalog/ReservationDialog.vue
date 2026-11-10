<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { Book } from '../../types/book'
import type { LoanRecord } from '../../types/loan'
import { formatLoanDate } from '../../types/loan'

const props = defineProps<{
  step: 'idle' | 'confirm' | 'success'
  book: Book | null
  loan: LoanRecord | null
  busy: boolean
  error: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'back'): void
  (e: 'confirm'): void
  (e: 'my-loans'): void
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const heading = ref<HTMLElement | null>(null)

watch(() => props.step, async (step) => {
  await nextTick()
  const element = dialog.value
  if (!element) return
  if (step === 'idle') {
    if (typeof element.close === 'function' && element.open) element.close()
    else element.removeAttribute('open')
    return
  }
  if (!element.open) {
    if (typeof element.showModal === 'function') element.showModal()
    else element.setAttribute('open', '')
  }
  heading.value?.focus()
}, { immediate: true })

function requestClose() {
  if (!props.busy) emit('close')
}

function onDialogClosed() {
  // Back/close sets step to idle first; the native close event must not clear the selected book again.
  if (props.step !== 'idle') requestClose()
}

function onCancel(event: Event) {
  event.preventDefault()
  requestClose()
}
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog narrow reservation-dialog"
    aria-modal="true"
    aria-labelledby="reservation-dialog-title"
    @cancel="onCancel"
    @close="onDialogClosed"
  >
    <template v-if="step !== 'idle' && book">
      <header class="dialog-header">
        <h1 id="reservation-dialog-title" ref="heading" tabindex="-1">
          {{ step === 'confirm' ? 'Xác nhận đặt mượn' : 'Kết quả đặt mượn' }}
        </h1>
        <button class="icon-btn" type="button" aria-label="Đóng hộp thoại" :disabled="busy" @click="requestClose">×</button>
      </header>

      <div v-if="step === 'confirm'" class="dialog-body">
        <h2 class="reservation-title">{{ book.title }}</h2>
        <dl class="reservation-facts">
          <div><dt>Số lượng</dt><dd>1 bản</dd></div>
          <div><dt>Nơi nhận</dt><dd>Thư viện CTU</dd></div>
        </dl>
        <p class="reservation-note">Đây là thao tác giữ chỗ. Hạn đến nhận sách sẽ do hệ thống xác định khi đặt thành công.</p>
        <p v-if="error" role="alert" class="notice error">{{ error }} Bạn có thể thử đặt lại.</p>
      </div>

      <div v-else class="dialog-body reservation-success" role="status">
        <span class="reservation-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6" /></svg>
        </span>
        <h2>Đặt mượn thành công</h2>
        <p>{{ book.title }}</p>
        <div class="reservation-deadline">
          <span>Nhận sách trước</span>
          <strong>{{ formatLoanDate(loan?.reservationExpiryDate) }}</strong>
        </div>
        <p>Vui lòng đến Thư viện CTU nhận sách trước hạn.</p>
      </div>

      <footer class="dialog-footer">
        <template v-if="step === 'confirm'">
          <button class="btn" type="button" :disabled="busy" @click="emit('back')">Quay lại</button>
          <button class="btn primary" type="button" :disabled="busy" @click="emit('confirm')">
            {{ busy ? 'Đang đặt mượn…' : 'Xác nhận đặt mượn' }}
          </button>
        </template>
        <template v-else>
          <button class="btn" type="button" @click="requestClose">Đóng</button>
          <button class="btn primary" type="button" @click="emit('my-loans')">Xem phiếu của tôi</button>
        </template>
      </footer>
    </template>
  </dialog>
</template>

<style scoped>
.reservation-dialog {
  overflow-y: auto;
  max-height: calc(100dvh - 32px);
}

.reservation-dialog::backdrop { background: var(--backdrop-dialog); }

.reservation-dialog .dialog-header { align-items: center; }

.reservation-title {
  margin: 0 0 20px;
  font-size: 19px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.reservation-facts {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.reservation-facts > div, .reservation-deadline {
  background: var(--raised);
  padding: 14px;
  border-radius: 10px;
}

.reservation-facts dt, .reservation-deadline span {
  display: block;
  margin-bottom: 5px;
  font-size: 12px;
  color: var(--muted);
}

.reservation-facts dd { margin: 0; font-weight: 650; }

.reservation-note { margin: 20px 0 0; font-size: 13px; line-height: 1.6; color: var(--muted); }

.reservation-dialog .notice { margin-top: 14px; }

.reservation-success { text-align: center; }

.reservation-success h2 { margin: 12px 0 6px; font-size: 20px; }

.reservation-success p { color: var(--muted); line-height: 1.6; overflow-wrap: anywhere; }

.reservation-check {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #dcfce7;
  color: #166534;
}

.reservation-deadline { margin: 20px 0; text-align: left; }

.reservation-deadline strong { font-size: 17px; }

@media (max-width: 520px) {
  .reservation-dialog { width: calc(100% - 20px); max-height: calc(100dvh - 20px); height: auto; border-radius: 12px; }
  .reservation-facts { grid-template-columns: 1fr; }
  .reservation-dialog .dialog-footer { flex-direction: column-reverse; align-items: stretch; }
  .reservation-dialog .dialog-footer .btn { width: 100%; min-height: 44px; }
}
</style>
