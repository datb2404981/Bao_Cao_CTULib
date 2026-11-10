<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { getAccounts, updateAccount } from '../services/account'
import type { AccountRow, AccountRole } from '../types/account'

const rows = ref<AccountRow[]>([])
const loading = ref(true)
const error = ref('')
const notice = ref('')
const searchInput = ref('')
const search = ref('')
const role = ref<'' | AccountRole>('')
const status = ref<'' | 'true' | 'false'>('')
const page = ref(1)
const limit = 10
const totalItems = ref(0)
const totalPages = ref(1)
const selected = ref<AccountRow | null>(null)
const email = ref('')
const active = ref(true)
const saving = ref(false)
const formError = ref('')
const dialog = ref<HTMLDialogElement | null>(null)
let requestId = 0
let returnFocus: HTMLElement | null = null

const roleLabel: Record<AccountRole, string> = { READER: 'Độc giả', EMPLOYEE: 'Nhân viên', ADMIN: 'Quản trị viên' }

const load = async () => {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const result = await getAccounts({ page: page.value, limit, search: search.value, role: role.value || undefined, isActive: status.value || undefined })
    if (id !== requestId) return
    rows.value = result.items
    totalItems.value = result.meta.totalItems
    totalPages.value = Math.max(1, result.meta.totalPages)
    page.value = result.meta.currentPage
  } catch (cause) {
    if (id !== requestId) return
    rows.value = []
    totalItems.value = 0
    totalPages.value = 1
    error.value = cause instanceof Error ? cause.message : 'Không tải được danh sách tài khoản.'
  } finally { if (id === requestId) loading.value = false }
}

const applyFilters = () => { page.value = 1; search.value = searchInput.value.trim(); void load() }
const movePage = (target: number) => { if (loading.value || target < 1 || target > totalPages.value) return; page.value = target; void load() }

const openEdit = async (row: AccountRow) => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  selected.value = row
  email.value = row.email
  active.value = row.isActive
  formError.value = ''
  await nextTick()
  dialog.value?.showModal()
  dialog.value?.querySelector<HTMLInputElement>('input[type="email"]')?.focus()
}
const close = () => {
  if (saving.value) return
  dialog.value?.close()
  selected.value = null
  nextTick(() => returnFocus?.focus())
}
const save = async () => {
  if (!selected.value || saving.value) return
  const normalizedEmail = email.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { formError.value = 'Vui lòng nhập email hợp lệ.'; return }
  saving.value = true
  formError.value = ''
  try {
    const updated = await updateAccount(selected.value._id, { email: normalizedEmail, isActive: active.value })
    notice.value = `Đã cập nhật tài khoản ${updated.ctuIdentifier}.`
    saving.value = false
    close()
    await load()
  } catch (cause) {
    formError.value = cause instanceof Error ? cause.message : 'Không thể cập nhật tài khoản.'
  } finally { saving.value = false }
}

onMounted(load)
onUnmounted(() => { requestId++ })
</script>

<template>
  <div class="accounts-view container">
    <div class="page-head"><div><h1>Quản lý tài khoản</h1><p class="muted">Tra cứu tài khoản, cập nhật email và trạng thái hoạt động.</p></div></div>
    <div v-if="notice" class="notice success" role="status">{{ notice }} <button class="btn small" type="button" @click="notice = ''">Đóng</button></div>
    <div v-if="error" class="notice error" role="alert">{{ error }} <button class="btn small" type="button" @click="load">Thử lại</button></div>
    <form class="filters account-filters" @submit.prevent="applyFilters">
      <label class="field account-search"><span>Tìm tài khoản</span><input v-model="searchInput" type="search" maxlength="120" placeholder="Mã CTU, họ tên hoặc email"></label>
      <label class="field"><span>Vai trò</span><select v-model="role" @change="applyFilters"><option value="">Tất cả</option><option value="READER">Độc giả</option><option value="EMPLOYEE">Nhân viên</option><option value="ADMIN">Quản trị viên</option></select></label>
      <label class="field"><span>Trạng thái</span><select v-model="status" @change="applyFilters"><option value="">Tất cả</option><option value="true">Đang hoạt động</option><option value="false">Đã vô hiệu hóa</option></select></label>
      <button class="btn primary" type="submit" :disabled="loading">Tìm kiếm</button>
      <button class="btn" type="button" :disabled="loading" @click="load">Tải lại</button>
    </form>
    <div class="table-wrap" role="region" aria-label="Danh sách tài khoản, có thể cuộn ngang" tabindex="0" :aria-busy="loading">
      <table><caption class="sr-only">Danh sách tài khoản trong thư viện</caption><thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Vai trò</th><th>Trạng thái</th><th>Quyền mượn</th><th>Thao tác</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="6" class="empty-state" role="status">Đang tải tài khoản…</td></tr>
          <tr v-else-if="!rows.length"><td colspan="6" class="empty-state">{{ error ? 'Không thể tải dữ liệu.' : 'Không tìm thấy tài khoản phù hợp.' }}</td></tr>
          <tr v-for="row in loading ? [] : rows" :key="row._id">
            <td><strong>{{ row.ctuIdentifier }}</strong><span class="record-id">{{ row.email }}</span></td>
            <td>{{ row.fullName || 'Chưa cập nhật' }}</td>
            <td>{{ roleLabel[row.role] }}</td>
            <td><span class="badge" :class="row.isActive ? 'green' : 'red'">{{ row.isActive ? 'Hoạt động' : 'Vô hiệu hóa' }}</span></td>
            <td><template v-if="row.role === 'READER'"><span class="badge" :class="row.isBorrowingBlocked || row.isBorrowingManuallyBlocked ? 'orange' : 'green'">{{ row.isBorrowingBlocked || row.isBorrowingManuallyBlocked ? 'Đang bị chặn' : 'Được mượn' }}</span></template><span v-else>—</span></td>
            <td><button class="btn small" type="button" :aria-label="`Chỉnh sửa tài khoản ${row.ctuIdentifier}`" @click="openEdit(row)">Chỉnh sửa</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="account-pagination"><span class="muted">{{ totalItems }} tài khoản · Trang {{ page }}/{{ totalPages }}</span><div class="row"><button class="btn small" type="button" :disabled="loading || page <= 1" @click="movePage(page - 1)">Trước</button><button class="btn small" type="button" :disabled="loading || page >= totalPages" @click="movePage(page + 1)">Sau</button></div></div>
    <dialog v-if="selected" ref="dialog" class="dialog account-dialog" aria-labelledby="account-dialog-title" @cancel.prevent="close">
      <header class="dialog-header"><h2 id="account-dialog-title">Chỉnh sửa tài khoản {{ selected.ctuIdentifier }}</h2><button class="btn small" type="button" :disabled="saving" @click="close">Đóng</button></header>
      <form novalidate @submit.prevent="save">
        <div class="dialog-body">
          <p v-if="formError" class="notice error" role="alert">{{ formError }}</p>
          <p class="muted">Vai trò: {{ roleLabel[selected.role] }}. Quản lý phân quyền tại hồ sơ nhân viên.</p>
          <label class="field"><span>Email</span><input v-model="email" type="email" maxlength="254" required autocomplete="off" :aria-invalid="!!formError" :disabled="saving"></label>
          <label class="checkline account-switch"><input v-model="active" type="checkbox" :disabled="saving"><span>Cho phép tài khoản hoạt động</span></label>
        </div>
        <footer class="dialog-footer"><button class="btn" type="button" :disabled="saving" @click="close">Hủy</button><button class="btn primary" type="submit" :disabled="saving">{{ saving ? 'Đang lưu…' : 'Lưu thay đổi' }}</button></footer>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.accounts-view { padding-bottom: 48px; }
.account-filters { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
.account-search { flex: 1 1 240px; }
.account-filters .field { min-width: 145px; }
.record-id { display: block; color: var(--muted); font-size: 12px; margin-top: 4px; overflow-wrap: anywhere; }
.account-pagination { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 18px 0; }
.account-dialog { position: fixed; inset: 0; margin: auto; width: min(520px, calc(100vw - 24px)); max-height: 90dvh; overflow-y: auto; }
.account-dialog:not([open]) { display: none; }
.account-switch { margin: 16px 0; }
@media (max-width: 640px) { .account-pagination { align-items: flex-start; flex-direction: column; } .account-filters .field { flex: 1 1 100%; } .account-filters .btn { flex: 1 1 auto; } }
</style>
