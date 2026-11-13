<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { createStaffAccount, getAccounts, updateAccount } from '../services/account'
import { getPermissions, updateEmployee } from '../services/people'
import type { AccountRole, AccountRoleFilter, AccountRow } from '../types/account'
import type { Permission } from '../types/people'

const rows = ref<AccountRow[]>([])
const permissions = ref<Permission[]>([])
const loading = ref(true)
const error = ref('')
const notice = ref('')
const searchInput = ref('')
const search = ref('')
const role = ref<'' | AccountRoleFilter>('')
const status = ref<'' | 'true' | 'false'>('')
const page = ref(1)
const limit = 10
const totalItems = ref(0)
const totalPages = ref(1)

const selected = ref<AccountRow | null>(null)
const email = ref('')
const active = ref(true)
const editPermissionIds = ref<string[]>([])
const saving = ref(false)
const formError = ref('')
const dialog = ref<HTMLDialogElement | null>(null)

const createOpen = ref(false)
const creating = ref(false)
const createError = ref('')
const createDialog = ref<HTMLDialogElement | null>(null)
const staffForm = reactive({
  ctuIdentifier: '',
  email: '',
  password: '',
  role: 'EMPLOYEE' as 'EMPLOYEE' | 'ADMIN',
  fullName: '',
  position: '',
  phoneNumber: '',
  permissionIds: [] as string[],
})

let requestId = 0
let returnFocus: HTMLElement | null = null

const roleLabel: Record<AccountRole, string> = { READER: 'Độc giả', EMPLOYEE: 'Nhân viên', ADMIN: 'Quản trị viên' }
const permissionMap = computed(() => new Map(permissions.value.map((p) => [p._id, p.permissionName])))
const activeSegment = computed(() => {
  if (role.value === 'READER') return 'reader'
  if (role.value === 'STAFF' || role.value === 'EMPLOYEE' || role.value === 'ADMIN') return 'staff'
  return 'all'
})

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

const loadPermissions = async () => {
  try {
    permissions.value = await getPermissions()
  } catch {
    permissions.value = []
  }
}

const selectSegment = (target: 'all' | 'staff' | 'reader') => {
  role.value = target === 'staff' ? 'STAFF' : target === 'reader' ? 'READER' : ''
  page.value = 1
  void load()
}

const applyFilters = () => { page.value = 1; search.value = searchInput.value.trim(); void load() }
const movePage = (target: number) => { if (loading.value || target < 1 || target > totalPages.value) return; page.value = target; void load() }

const openEdit = async (row: AccountRow) => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  selected.value = row
  email.value = row.email
  active.value = row.isActive
  editPermissionIds.value = [...(row.permissionIds ?? [])]
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
    if (selected.value.role !== 'READER') {
      const prev = [...(selected.value.permissionIds ?? [])].sort().join(',')
      const next = [...editPermissionIds.value].sort().join(',')
      if (prev !== next) {
        await updateEmployee(selected.value._id, {
          fullName: selected.value.fullName || selected.value.ctuIdentifier,
          permissionIds: editPermissionIds.value,
        })
      }
    }
    notice.value = `Đã cập nhật tài khoản ${updated.ctuIdentifier}.`
    saving.value = false
    close()
    await load()
  } catch (cause) {
    formError.value = cause instanceof Error ? cause.message : 'Không thể cập nhật tài khoản.'
  } finally { saving.value = false }
}

const openCreateStaff = async () => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  Object.assign(staffForm, {
    ctuIdentifier: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    fullName: '',
    position: '',
    phoneNumber: '',
    permissionIds: [],
  })
  createError.value = ''
  createOpen.value = true
  await nextTick()
  createDialog.value?.showModal()
  createDialog.value?.querySelector<HTMLInputElement>('input[name="ctuIdentifier"]')?.focus()
}

const closeCreateStaff = () => {
  if (creating.value) return
  createDialog.value?.close()
  createOpen.value = false
  nextTick(() => returnFocus?.focus())
}

const submitCreateStaff = async () => {
  if (creating.value) return
  const ctuIdentifier = staffForm.ctuIdentifier.trim()
  const normalizedEmail = staffForm.email.trim()
  const fullName = staffForm.fullName.trim()
  if (ctuIdentifier.length < 3) { createError.value = 'Mã cán bộ / nhân viên tối thiểu 3 ký tự.'; return }
  if (!fullName) { createError.value = 'Vui lòng nhập họ và tên nhân viên.'; return }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { createError.value = 'Vui lòng nhập email hợp lệ.'; return }
  if (staffForm.password.length < 8) { createError.value = 'Mật khẩu tối thiểu 8 ký tự.'; return }

  creating.value = true
  createError.value = ''
  try {
    const created = await createStaffAccount({
      ctuIdentifier,
      email: normalizedEmail,
      password: staffForm.password,
      role: staffForm.role,
      fullName,
      position: staffForm.position.trim() || undefined,
      phoneNumber: staffForm.phoneNumber.trim() || undefined,
      permissionIds: [...staffForm.permissionIds],
    })
    notice.value = `Đã tạo tài khoản nhân viên ${created.ctuIdentifier}.`
    creating.value = false
    closeCreateStaff()
    role.value = 'STAFF'
    page.value = 1
    await load()
  } catch (cause) {
    createError.value = cause instanceof Error ? cause.message : 'Không thể tạo tài khoản nhân viên.'
  } finally { creating.value = false }
}

onMounted(() => {
  void load()
  void loadPermissions()
})
onUnmounted(() => { requestId++ })
</script>

<template>
  <div class="accounts-view container">
    <div class="page-head accounts-head">
      <div>
        <h1>Quản lý tài khoản</h1>
        <p class="muted">Tạo tài khoản nhân viên, phân quyền chức năng và quản lý riêng độc giả, nhân viên.</p>
      </div>
      <button class="btn primary" type="button" @click="openCreateStaff">+ Tạo tài khoản nhân viên</button>
    </div>

    <div class="account-tabs" role="tablist" aria-label="Phân loại tài khoản">
      <button type="button" role="tab" class="tab-btn" :class="{ active: activeSegment === 'all' }" :aria-selected="activeSegment === 'all'" @click="selectSegment('all')">Tất cả</button>
      <button type="button" role="tab" class="tab-btn" :class="{ active: activeSegment === 'staff' }" :aria-selected="activeSegment === 'staff'" @click="selectSegment('staff')">Nhân viên & Quản trị</button>
      <button type="button" role="tab" class="tab-btn" :class="{ active: activeSegment === 'reader' }" :aria-selected="activeSegment === 'reader'" @click="selectSegment('reader')">Độc giả</button>
    </div>

    <div v-if="notice" class="notice success" role="status">{{ notice }} <button class="btn small" type="button" @click="notice = ''">Đóng</button></div>
    <div v-if="error" class="notice error" role="alert">{{ error }} <button class="btn small" type="button" @click="load">Thử lại</button></div>

    <form class="filters account-filters" @submit.prevent="applyFilters">
      <label class="field account-search"><span>Tìm tài khoản</span><input v-model="searchInput" type="search" maxlength="120" placeholder="Mã CTU, họ tên hoặc email"></label>
      <label class="field"><span>Vai trò</span>
        <select v-model="role" @change="applyFilters">
          <option value="">Tất cả</option>
          <option value="STAFF">Nhân viên & Quản trị</option>
          <option value="READER">Độc giả</option>
          <option value="EMPLOYEE">Nhân viên</option>
          <option value="ADMIN">Quản trị viên</option>
        </select>
      </label>
      <label class="field"><span>Trạng thái</span>
        <select v-model="status" @change="applyFilters">
          <option value="">Tất cả</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Đã vô hiệu hóa</option>
        </select>
      </label>
      <button class="btn primary" type="submit" :disabled="loading">Tìm kiếm</button>
      <button class="btn" type="button" :disabled="loading" @click="load">Tải lại</button>
    </form>

    <div class="table-wrap" role="region" aria-label="Danh sách tài khoản, có thể cuộn ngang" tabindex="0" :aria-busy="loading">
      <table><caption class="sr-only">Danh sách tài khoản trong thư viện</caption><thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Vai trò</th><th>Trạng thái</th><th>Quyền hạn / Mượn sách</th><th>Thao tác</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="6" class="empty-state" role="status">Đang tải tài khoản…</td></tr>
          <tr v-else-if="!rows.length"><td colspan="6" class="empty-state">{{ error ? 'Không thể tải dữ liệu.' : 'Không tìm thấy tài khoản phù hợp.' }}</td></tr>
          <tr v-for="row in loading ? [] : rows" :key="row._id">
            <td><strong>{{ row.ctuIdentifier }}</strong><span class="record-id">{{ row.email }}</span></td>
            <td>{{ row.fullName || 'Chưa cập nhật' }}<span v-if="row.position" class="record-id">{{ row.position }}</span></td>
            <td>{{ roleLabel[row.role] }}</td>
            <td><span class="badge" :class="row.isActive ? 'green' : 'red'">{{ row.isActive ? 'Hoạt động' : 'Vô hiệu hóa' }}</span></td>
            <td>
              <template v-if="row.role === 'READER'">
                <span class="badge" :class="row.isBorrowingBlocked || row.isBorrowingManuallyBlocked ? 'orange' : 'green'">{{ row.isBorrowingBlocked || row.isBorrowingManuallyBlocked ? 'Đang bị chặn' : 'Được mượn' }}</span>
              </template>
              <template v-else>
                <span v-if="!row.permissionIds?.length" class="muted">Chưa cấp quyền</span>
                <div v-else class="perm-tags">
                  <span v-for="permId in row.permissionIds" :key="permId" class="badge blue">{{ permissionMap.get(permId) || 'Quyền chức năng' }}</span>
                </div>
              </template>
            </td>
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
          <p class="muted">Vai trò: {{ roleLabel[selected.role] }}.</p>
          <label class="field"><span>Email</span><input v-model="email" type="email" maxlength="254" required autocomplete="off" :aria-invalid="!!formError" :disabled="saving"></label>
          <label class="checkline account-switch"><input v-model="active" type="checkbox" :disabled="saving"><span>Cho phép tài khoản hoạt động</span></label>
          <section v-if="selected.role !== 'READER'" class="perm-section">
            <h3>Phân quyền chức năng</h3>
            <p v-if="!permissions.length" class="muted">Chưa có quyền chức năng trong danh mục.</p>
            <div v-else class="perm-list">
              <label v-for="permission in permissions" :key="permission._id" class="checkline perm-item">
                <input v-model="editPermissionIds" type="checkbox" :value="permission._id" :disabled="saving">
                <span><strong>{{ permission.permissionName }}</strong><small v-if="permission.description" class="muted">{{ permission.description }}</small></span>
              </label>
            </div>
          </section>
        </div>
        <footer class="dialog-footer"><button class="btn" type="button" :disabled="saving" @click="close">Hủy</button><button class="btn primary" type="submit" :disabled="saving">{{ saving ? 'Đang lưu…' : 'Lưu thay đổi' }}</button></footer>
      </form>
    </dialog>

    <dialog v-if="createOpen" ref="createDialog" class="dialog account-dialog" aria-labelledby="create-staff-title" @cancel.prevent="closeCreateStaff">
      <header class="dialog-header"><h2 id="create-staff-title">Tạo tài khoản nhân viên</h2><button class="btn small" type="button" :disabled="creating" @click="closeCreateStaff">Đóng</button></header>
      <form novalidate @submit.prevent="submitCreateStaff">
        <div class="dialog-body">
          <p v-if="createError" class="notice error" role="alert">{{ createError }}</p>
          <div class="staff-grid">
            <label class="field"><span>Mã cán bộ / nhân viên <b class="required">*</b></span><input v-model="staffForm.ctuIdentifier" name="ctuIdentifier" type="text" maxlength="32" required placeholder="VD: CB1001" :disabled="creating"></label>
            <label class="field"><span>Vai trò <b class="required">*</b></span>
              <select v-model="staffForm.role" name="staffRole" :disabled="creating">
                <option value="EMPLOYEE">Nhân viên</option>
                <option value="ADMIN">Quản trị viên</option>
              </select>
            </label>
            <label class="field full"><span>Họ và tên <b class="required">*</b></span><input v-model="staffForm.fullName" name="fullName" type="text" maxlength="100" required placeholder="Nhập họ tên nhân viên" :disabled="creating"></label>
            <label class="field"><span>Email <b class="required">*</b></span><input v-model="staffForm.email" name="staffEmail" type="email" maxlength="254" required placeholder="nhanvien@ctu.edu.vn" :disabled="creating"></label>
            <label class="field"><span>Mật khẩu <b class="required">*</b></span><input v-model="staffForm.password" name="staffPassword" type="password" minlength="8" maxlength="128" required placeholder="Tối thiểu 8 ký tự" :disabled="creating"></label>
            <label class="field"><span>Chức vụ</span><input v-model="staffForm.position" name="position" type="text" maxlength="100" placeholder="VD: Thủ thư" :disabled="creating"></label>
            <label class="field"><span>Số điện thoại</span><input v-model="staffForm.phoneNumber" name="phoneNumber" type="tel" maxlength="20" placeholder="VD: 0901234567" :disabled="creating"></label>
          </div>
          <section class="perm-section">
            <h3>Cấp quyền chức năng</h3>
            <p v-if="!permissions.length" class="muted">Chưa có quyền chức năng nào. Có thể cấp sau trong mục Quyền chức năng.</p>
            <div v-else class="perm-list">
              <label v-for="permission in permissions" :key="permission._id" class="checkline perm-item">
                <input v-model="staffForm.permissionIds" type="checkbox" :value="permission._id" :disabled="creating">
                <span><strong>{{ permission.permissionName }}</strong><small v-if="permission.description" class="muted">{{ permission.description }}</small></span>
              </label>
            </div>
          </section>
        </div>
        <footer class="dialog-footer"><button class="btn" type="button" :disabled="creating" @click="closeCreateStaff">Hủy</button><button class="btn primary" type="submit" :disabled="creating">{{ creating ? 'Đang tạo…' : 'Tạo tài khoản' }}</button></footer>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.accounts-view { padding-bottom: 48px; }
.accounts-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.account-tabs { display: inline-flex; flex-wrap: wrap; gap: 6px; padding: 4px; margin-bottom: 16px; background: var(--color-surface, #ffffff); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.tab-btn { padding: 7px 14px; border: none; border-radius: 4px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 0.9rem; font-weight: 500; cursor: pointer; }
.tab-btn.active { background: var(--color-primary); color: #ffffff; font-weight: 600; }
.account-filters { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
.account-search { flex: 1 1 240px; }
.account-filters .field { min-width: 145px; }
.record-id { display: block; color: var(--muted); font-size: 12px; margin-top: 4px; overflow-wrap: anywhere; }
.perm-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.account-pagination { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 18px 0; }
.account-dialog { position: fixed; inset: 0; margin: auto; width: min(560px, calc(100vw - 24px)); max-height: 90dvh; overflow-y: auto; }
.account-dialog:not([open]) { display: none; }
.account-switch { margin: 16px 0; }
.staff-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.staff-grid .full { grid-column: 1 / -1; }
.perm-section { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--color-border-subtle); }
.perm-section h3 { font-size: 0.95rem; margin-bottom: 8px; }
.perm-list { display: grid; gap: 8px; max-height: 180px; overflow-y: auto; }
.perm-item { align-items: flex-start; }
.perm-item small { display: block; font-size: 0.78rem; }
@media (max-width: 640px) {
  .account-pagination { align-items: flex-start; flex-direction: column; }
  .account-filters .field { flex: 1 1 100%; }
  .account-filters .btn { flex: 1 1 auto; }
  .staff-grid { grid-template-columns: 1fr; }
}
</style>
