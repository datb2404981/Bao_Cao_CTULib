<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { AuthError, currentUser, refreshAuthorization } from '../services/auth'
import { canAccess } from '../middlewares/access'
import * as api from '../services/people'
import { getAllFaculties } from '../services/faculty'
import type { Faculty } from '../types/faculty'
import type { Reader, Employee, Permission, ReaderInput, EmployeeInput } from '../types/people'

type Resource = 'reader' | 'employee' | 'permission'
type Row = Reader | Employee | Permission
const props = defineProps<{ resource: Resource }>()
const meta = computed(() => ({
  reader: { title: 'Độc giả', singular: 'độc giả', description: 'Hồ sơ bạn đọc, khoa/viện và tình trạng quyền mượn.' },
  employee: { title: 'Nhân viên', singular: 'nhân viên', description: 'Hồ sơ nhân viên thư viện và các quyền chức năng được cấp.' },
  permission: { title: 'Quyền chức năng', singular: 'quyền', description: 'Danh mục quyền dùng để cấp cho nhân viên và kiểm soát thao tác.' },
})[props.resource])
const authorized = computed(() => canAccess(currentUser.value, props.resource))
const rows = ref<Row[]>([])
const faculties = ref<Faculty[]>([])
const permissions = ref<Permission[]>([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const query = ref('')
const filter = ref('')
const page = ref(1)
const pageSize = 10
const dialog = ref<HTMLDialogElement | null>(null)
const selected = ref<Row | null>(null)
const opened = ref(false)
const editing = ref(false)
const saving = ref(false)
const blocking = ref(false)
const blockReason = ref('')
const blockError = ref('')
const formError = ref('')
const fieldErrors = ref<Record<string, string>>({})
const form = reactive({ accountId: '', fullName: '', dateOfBirth: '', phoneNumber: '', address: '', readerType: '', facultyId: '', position: '', permissionIds: [] as string[], permissionName: '', description: '' })
const readerTypes: Record<string, string> = { STUDENT: 'Sinh viên', POSTGRADUATE: 'Học viên sau đại học', STAFF: 'Cán bộ' }
const knownPermissions = [
  { name: 'MANAGE_BOOKS', label: 'Quản lý sách' },
  { name: 'MANAGE_FACULTIES', label: 'Quản lý khoa/viện' },
  { name: 'MANAGE_AUTHORS', label: 'Quản lý tác giả' },
]
const nameOf = (row: Row) => 'permissionName' in row ? row.permissionName : row.fullName || 'Chưa có họ tên'
const isReaderBlocked = (reader: Reader) => reader.isBorrowingBlocked || !!reader.isBorrowingManuallyBlocked
const facultyName = (id: string) => faculties.value.find((faculty) => faculty._id === id)?.facultyName || id
const permissionName = (id: string) => permissions.value.find((permission) => permission._id === id)?.permissionName || `Quyền không còn tồn tại (${id})`
const filtered = computed(() => rows.value.filter((row) => {
  const text = [row._id, nameOf(row), 'phoneNumber' in row ? row.phoneNumber : '', 'position' in row ? row.position : '', 'description' in row ? row.description : '', 'facultyId' in row ? facultyName(row.facultyId) : ''].join(' ').toLocaleLowerCase('vi')
  if (!text.includes(query.value.trim().toLocaleLowerCase('vi'))) return false
  if (props.resource === 'reader' && 'isBorrowingBlocked' in row && filter.value) return filter.value === 'blocked' ? isReaderBlocked(row) : !isReaderBlocked(row)
  if (props.resource === 'employee' && 'permissionIds' in row && filter.value) return filter.value === 'assigned' ? row.permissionIds.length > 0 : row.permissionIds.length === 0
  return true
}))
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visibleRows = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([query, filter], () => { page.value = 1 })
watch(totalPages, (count) => { page.value = Math.min(page.value, count) })
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
let alive = true
let returnFocus: HTMLElement | null = null

const load = async () => {
  if (!authorized.value) return
  loading.value = true
  error.value = ''
  try {
    const [data, facultyData, permissionData] = await Promise.all([
      props.resource === 'reader' ? api.getReaders() : props.resource === 'employee' ? api.getEmployees() : api.getPermissions(),
      props.resource === 'reader' ? getAllFaculties() : Promise.resolve([]),
      props.resource === 'employee' ? api.getPermissions() : Promise.resolve([]),
    ])
    if (!alive || !authorized.value) return
    rows.value = data
    faculties.value = facultyData
    permissions.value = permissionData
  } catch (cause) {
    if (!alive) return
    rows.value = []
    error.value = cause instanceof Error ? cause.message : 'Không thể tải dữ liệu.'
    if (cause instanceof AuthError && [401, 403].includes(cause.status)) await refreshAuthorization().catch(() => {})
  } finally { if (alive) loading.value = false }
}
const close = () => {
  if (saving.value || blocking.value) return
  dialog.value?.close()
  opened.value = false
  returnFocus?.focus()
}
const open = async (row: Row | null) => {
  if (!authorized.value) return
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  selected.value = row
  editing.value = !row
  formError.value = ''
  blockError.value = ''
  blockReason.value = row && 'borrowingBlockReason' in row ? row.borrowingBlockReason || '' : ''
  fieldErrors.value = {}
  Object.assign(form, { accountId: row?._id || '', fullName: '', dateOfBirth: '', phoneNumber: '', address: '', readerType: '', facultyId: '', position: '', permissionIds: [], permissionName: '', description: '' })
  if (row) {
    if ('permissionName' in row) Object.assign(form, { permissionName: row.permissionName, description: row.description })
    else {
      Object.assign(form, { fullName: row.fullName || '', phoneNumber: row.phoneNumber || '', address: row.address || '' })
      if ('facultyId' in row) Object.assign(form, { facultyId: row.facultyId, dateOfBirth: row.dateOfBirth?.slice(0, 10) || '', readerType: row.readerType || '' })
      if ('permissionIds' in row) Object.assign(form, { position: row.position || '', permissionIds: [...row.permissionIds] })
    }
  }
  opened.value = true
  await nextTick()
  dialog.value?.showModal()
}
const save = async () => {
  if (saving.value || !authorized.value || !editing.value) return
  fieldErrors.value = {}
  formError.value = ''
  if (props.resource !== 'permission') {
    if (!selected.value && !/^[a-f\d]{24}$/i.test(form.accountId.trim())) fieldErrors.value.accountId = 'Nhập ID tài khoản gồm 24 ký tự hex.'
    if (selected.value && 'fullName' in selected.value && selected.value.fullName && !form.fullName.trim()) fieldErrors.value.fullName = 'Nhập họ tên để thay đổi thông tin đã lưu.'
    if (form.fullName.trim() && (form.fullName.trim().length < 2 || form.fullName.trim().length > 50)) fieldErrors.value.fullName = 'Họ tên phải có từ 2 đến 50 ký tự.'
  }
  if (props.resource === 'reader') {
    if (!form.facultyId) fieldErrors.value.facultyId = 'Vui lòng chọn khoa/viện.'
    if (form.dateOfBirth && form.dateOfBirth >= today) fieldErrors.value.dateOfBirth = 'Ngày sinh phải trước ngày hiện tại.'
    if (selected.value && 'dateOfBirth' in selected.value && selected.value.dateOfBirth && !form.dateOfBirth) fieldErrors.value.dateOfBirth = 'Nhập ngày sinh để thay đổi thông tin đã lưu.'
  }
  if (props.resource === 'permission') {
    if (!form.permissionName.trim()) fieldErrors.value.permissionName = 'Vui lòng nhập tên quyền.'
    if (!form.description.trim()) fieldErrors.value.description = 'Vui lòng nhập mô tả quyền.'
  }
  if (Object.keys(fieldErrors.value).length) {
    await nextTick()
    dialog.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  saving.value = true
  try {
    if (props.resource === 'reader') {
      const input: ReaderInput = {
        ...(form.fullName.trim() ? { fullName: form.fullName.trim() } : {}), phoneNumber: form.phoneNumber.trim(), address: form.address.trim(),
        facultyId: form.facultyId, ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
        ...(form.readerType ? { readerType: form.readerType as Reader['readerType'] } : {}),
      }
      if (selected.value) await api.updateReader(selected.value._id, input)
      else await api.createReader({ ...input, accountId: form.accountId.trim() })
    } else if (props.resource === 'employee') {
      const input: EmployeeInput = { ...(form.fullName.trim() ? { fullName: form.fullName.trim() } : {}), position: form.position.trim(), phoneNumber: form.phoneNumber.trim(), address: form.address.trim(), permissionIds: [...form.permissionIds] }
      if (selected.value) await api.updateEmployee(selected.value._id, input)
      else await api.createEmployee({ ...input, accountId: form.accountId.trim() })
    } else {
      const input = { permissionName: form.permissionName.trim(), description: form.description.trim() }
      if (selected.value) await api.updatePermission(selected.value._id, input)
      else await api.createPermission(input)
    }
    success.value = `Đã ${selected.value ? 'cập nhật' : 'thêm'} ${meta.value.singular} thành công.`
    saving.value = false
    close()
    // Cấp/thu hồi quyền của chính mình phải được phản ánh ngay trong điều hướng.
    await refreshAuthorization()
    await load()
  } catch (cause) {
    formError.value = cause instanceof Error ? cause.message : 'Không thể lưu dữ liệu.'
    if (cause instanceof AuthError) {
      fieldErrors.value = cause.fields
      if ([401, 403].includes(cause.status)) await refreshAuthorization().catch(() => {})
    }
  } finally { saving.value = false }
}
const changeBorrowingBlock = async () => {
  const reader = selected.value
  if (!reader || !('isBorrowingBlocked' in reader) || blocking.value || saving.value) return
  const blocked = !reader.isBorrowingManuallyBlocked
  if (blocked && blockReason.value.trim().length < 5) {
    blockError.value = 'Nhập lý do chặn mượn ít nhất 5 ký tự.'
    return
  }
  blocking.value = true
  blockError.value = ''
  try {
    const updated = await api.setBorrowingBlock(reader._id, { blocked, reason: blocked ? blockReason.value.trim() : '' })
    selected.value = updated
    rows.value = rows.value.map((row) => row._id === updated._id ? updated : row)
    blockReason.value = updated.borrowingBlockReason || ''
    success.value = blocked ? 'Đã chặn quyền mượn của độc giả.' : 'Đã gỡ chặn mượn thủ công.'
  } catch (cause) {
    blockError.value = cause instanceof Error ? cause.message : 'Không thể cập nhật quyền mượn.'
  } finally { blocking.value = false }
}
watch(authorized, (allowed) => {
  if (!allowed) {
    rows.value = []
    dialog.value?.close()
    opened.value = false
  }
})
onMounted(load)
onUnmounted(() => { alive = false })
</script>

<template>
  <div class="people-view container" :data-resource="resource">
    <div v-if="!authorized" class="notice warning" role="alert">Bạn không có quyền truy cập màn hình này.</div>
    <template v-else>
      <div class="page-head">
        <div><span class="eyebrow">Quản trị thư viện</span><h1>{{ meta.title }}</h1><p class="muted">{{ meta.description }}</p></div>
        <button class="btn primary" type="button" :disabled="loading || !!error" @click="open(null)">+ Thêm {{ meta.singular }}</button>
      </div>
      <div v-if="success" class="notice success" role="status">{{ success }} <button class="btn small" @click="success = ''" aria-label="Đóng thông báo">Đóng</button></div>
      <div v-if="error" class="notice error" role="alert">{{ error }} <button class="btn small" @click="load">Thử lại</button></div>
      <form class="filters" @submit.prevent>
        <div class="filter-row">
          <label class="field search-field"><span>Tìm {{ meta.singular }}</span><input v-model="query" type="search" placeholder="Nhập tên, ID hoặc thông tin liên hệ…"></label>
          <label v-if="resource !== 'permission'" class="field"><span>{{ resource === 'reader' ? 'Quyền mượn' : 'Quyền chức năng' }}</span><select v-model="filter"><option value="">Tất cả</option><template v-if="resource === 'reader'"><option value="active">Được mượn</option><option value="blocked">Đang bị chặn</option></template><template v-else><option value="assigned">Đã cấp quyền</option><option value="unassigned">Chưa cấp quyền</option></template></select></label>
          <button type="button" class="btn" :disabled="loading" @click="load">Tải lại</button>
        </div>
      </form>
      <div class="table-wrap" tabindex="0" role="region" :aria-label="`Bảng danh sách ${meta.singular}, có thể cuộn ngang`" :aria-busy="loading">
        <table><caption class="sr-only">Danh sách {{ meta.singular }}</caption><thead><tr><th>{{ resource === 'permission' ? 'Tên quyền' : 'Hồ sơ' }}</th><th>{{ resource === 'reader' ? 'Khoa/Viện' : resource === 'employee' ? 'Chức vụ' : 'Mô tả' }}</th><th v-if="resource !== 'permission'">{{ resource === 'reader' ? 'Loại độc giả' : 'Liên hệ' }}</th><th v-if="resource !== 'permission'">{{ resource === 'reader' ? 'Quyền mượn' : 'Quyền được cấp' }}</th><th>Thao tác</th></tr></thead>
          <tbody>
            <tr v-if="loading"><td :colspan="resource === 'permission' ? 3 : 5" class="empty-state" role="status">Đang tải {{ meta.singular }}…</td></tr>
            <tr v-else-if="!visibleRows.length"><td :colspan="resource === 'permission' ? 3 : 5" class="empty-state"><h3>{{ query || filter ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu' }}</h3><p>{{ query || filter ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : `Thêm ${meta.singular} đầu tiên để bắt đầu quản lý.` }}</p></td></tr>
            <tr v-for="row in loading ? [] : visibleRows" :key="row._id">
              <td><strong>{{ nameOf(row) }}</strong><span class="record-id">{{ row._id }}</span></td>
              <template v-if="'facultyId' in row"><td>{{ facultyName(row.facultyId) }}</td><td>{{ readerTypes[row.readerType || ''] || 'Chưa cập nhật' }}</td><td><span class="badge" :class="isReaderBlocked(row) ? 'orange' : 'green'">{{ isReaderBlocked(row) ? 'Đang bị chặn' : 'Được mượn' }}</span></td></template>
              <template v-else-if="'permissionIds' in row"><td>{{ row.position || 'Chưa cập nhật' }}</td><td>{{ row.phoneNumber || 'Chưa cập nhật' }}</td><td><span class="badge" :class="row.permissionIds.length ? 'blue' : ''">{{ row.permissionIds.length }} quyền</span></td></template>
              <td v-else-if="'description' in row">{{ row.description }}</td>
              <td><button class="btn small" type="button" :aria-label="`Xem ${nameOf(row)}`" @click="open(row)">{{ resource === 'permission' ? 'Xem quyền' : 'Xem hồ sơ' }}</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="people-pagination"><span class="muted">{{ filtered.length }} / {{ rows.length }} {{ meta.singular }}</span><div class="row"><button class="btn small" :disabled="page <= 1 || loading" @click="page--">Trước</button><span>Trang {{ page }} / {{ totalPages }}</span><button class="btn small" :disabled="page >= totalPages || loading" @click="page++">Sau</button></div></div>
      <p v-if="resource === 'permission'" class="muted policy-note">Quyền được cấp tại hồ sơ nhân viên. ADMIN cũng cần quyền chức năng khi quản lý sách, khoa/viện và tác giả.</p>
    </template>

    <dialog v-if="opened && authorized" ref="dialog" class="dialog wide people-dialog" aria-labelledby="people-dialog-title" @cancel.prevent="close">
      <header class="dialog-header"><div><h1 id="people-dialog-title">{{ editing ? (selected ? 'Chỉnh sửa' : 'Thêm') : 'Thông tin' }} {{ meta.singular }}</h1></div><button class="btn small" type="button" :disabled="saving || blocking" aria-label="Đóng hộp thoại" @click="close">Đóng</button></header>
      <form novalidate @submit.prevent="save">
        <div class="dialog-body">
          <div v-if="formError" class="notice error" role="alert">{{ formError }}</div>
          <div v-if="Object.keys(fieldErrors).length" class="notice error" role="alert"><ul><li v-for="(message, field) in fieldErrors" :key="field">{{ message }}</li></ul></div>
          <fieldset :disabled="!editing || saving" class="people-fields">
            <template v-if="resource === 'permission'">
              <label class="field"><span>Tên quyền <b class="required">*</b></span><input v-model="form.permissionName" required :aria-invalid="!!fieldErrors.permissionName" list="permission-suggestions" placeholder="Ví dụ: MANAGE_BOOKS"><datalist id="permission-suggestions"><option v-for="item in knownPermissions" :key="item.name" :value="item.name">{{ item.label }}</option></datalist></label>
              <label class="field"><span>Mô tả <b class="required">*</b></span><textarea v-model="form.description" required rows="3" :aria-invalid="!!fieldErrors.description"></textarea></label>
              <p class="muted">Các mã đang được ứng dụng kiểm tra: MANAGE_BOOKS, MANAGE_FACULTIES, MANAGE_AUTHORS. Quyền mới cần được nối vào chính sách để có tác dụng.</p>
            </template>
            <template v-else>
              <div class="grid2">
                <label class="field full"><span>ID tài khoản <b v-if="!selected" class="required">*</b></span><input v-model="form.accountId" :readonly="!!selected" :required="!selected" pattern="[a-fA-F0-9]{24}" :aria-invalid="!!fieldErrors.accountId"><small v-if="!selected" class="muted">Dùng ID tài khoản đã tồn tại, có role {{ resource === 'reader' ? 'READER' : 'EMPLOYEE hoặc ADMIN' }}. Mỗi tài khoản có một hồ sơ.</small></label>
                <label class="field"><span>Họ và tên</span><input v-model="form.fullName" maxlength="50" :aria-invalid="!!fieldErrors.fullName"></label>
                <label class="field"><span>Điện thoại</span><input v-model="form.phoneNumber" type="tel"></label>
                <template v-if="resource === 'reader'">
                  <label class="field"><span>Ngày sinh</span><input v-model="form.dateOfBirth" type="date" :max="today" :aria-invalid="!!fieldErrors.dateOfBirth"></label>
                  <label class="field"><span>Loại độc giả</span><select v-model="form.readerType"><option value="" :disabled="!!selected && 'readerType' in selected && !!selected.readerType">Chưa cập nhật</option><option v-for="(label, value) in readerTypes" :key="value" :value="value">{{ label }}</option></select></label>
                  <label class="field full"><span>Khoa/Viện <b class="required">*</b></span><select v-model="form.facultyId" required :aria-invalid="!!fieldErrors.facultyId"><option value="">Chọn khoa/viện</option><option v-if="form.facultyId && !faculties.some(f => f._id === form.facultyId)" :value="form.facultyId">{{ form.facultyId }}</option><option v-for="faculty in faculties" :key="faculty._id" :value="faculty._id">{{ faculty.facultyName }}</option></select></label>
                </template>
                <label v-else class="field full"><span>Chức vụ</span><input v-model="form.position"></label>
                <label class="field full"><span>Địa chỉ</span><textarea v-model="form.address" rows="2"></textarea></label>
              </div>
              <section v-if="resource === 'employee'" class="form-section"><h2>Quyền chức năng</h2><p class="muted">Chọn quyền cấp cho nhân viên. Bỏ chọn để thu hồi.</p><p v-if="!permissions.length" class="notice warning">Chưa có quyền chức năng. Hãy tạo quyền tại mục Quyền chức năng trước.</p><div class="permission-group"><label v-for="permission in permissions" :key="permission._id" class="checkline permission-option"><input v-model="form.permissionIds" type="checkbox" :value="permission._id"><span><strong>{{ permission.permissionName }}</strong><small class="muted">{{ permission.description }}</small></span></label><label v-for="id in form.permissionIds.filter(id => !permissions.some(p => p._id === id))" :key="id" class="checkline"><input v-model="form.permissionIds" type="checkbox" :value="id"><span>{{ permissionName(id) }} — bỏ chọn để xóa liên kết cũ</span></label></div><p class="muted">Đã chọn {{ form.permissionIds.length }} quyền.</p></section>
            </template>
          </fieldset>
          <div v-if="selected && 'isBorrowingBlocked' in selected" class="form-section borrowing-control">
            <h2>Kiểm soát quyền mượn</h2>
            <span class="badge" :class="isReaderBlocked(selected) ? 'orange' : 'green'">{{ isReaderBlocked(selected) ? 'Quyền mượn đang bị chặn' : 'Được phép mượn sách' }}</span>
            <p v-if="selected.isBorrowingBlocked" class="muted">Đang bị chặn do nghiệp vụ phạt. Gỡ chặn thủ công sẽ không thay đổi trạng thái này.</p>
            <p v-if="selected.isBorrowingManuallyBlocked" class="muted">Lý do khóa thủ công: {{ selected.borrowingBlockReason || 'Chưa ghi nhận' }}</p>
            <p v-if="blockError" class="notice error" role="alert">{{ blockError }}</p>
            <label v-if="!selected.isBorrowingManuallyBlocked" class="field"><span>Lý do chặn mượn thủ công</span><textarea v-model="blockReason" rows="2" maxlength="500" :disabled="blocking || saving" :aria-invalid="!!blockError" placeholder="Nhập lý do ít nhất 5 ký tự"></textarea></label>
            <button type="button" class="btn" :disabled="blocking || saving" @click="changeBorrowingBlock">{{ blocking ? 'Đang cập nhật…' : selected.isBorrowingManuallyBlocked ? 'Gỡ chặn thủ công' : 'Chặn mượn thủ công' }}</button>
          </div>
        </div>
        <footer class="dialog-footer"><button type="button" class="btn" :disabled="saving || blocking" @click="close">{{ editing ? 'Hủy bỏ' : 'Đóng' }}</button><button v-if="!editing" type="button" class="btn primary" :disabled="blocking" @click="editing = true">Chỉnh sửa</button><button v-else class="btn primary" type="submit" :disabled="saving || blocking">{{ saving ? 'Đang lưu…' : 'Lưu thay đổi' }}</button></footer>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.people-view { padding-bottom: 48px; }
.eyebrow { display: block; color: var(--muted); font-size: 12px; letter-spacing: .04em; margin-bottom: 6px; }
.page-head p { margin-top: 8px; max-width: 620px; }
.notice { margin-bottom: 20px; justify-content: space-between; }
.search-field { flex: 1; min-width: 200px; }
.filter-row { align-items: end; }
.record-id { display: block; color: var(--muted); font-size: 11px; margin-top: 6px; overflow-wrap: anywhere; }
td { vertical-align: middle; }
.people-pagination { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 0; }
.people-dialog { position: fixed; inset: 0; margin: auto; max-height: 90dvh; overflow-y: auto; }
.people-dialog:not([open]) { display: none; }
.people-fields { border: 0; padding: 0; margin: 0; min-width: 0; display: grid; gap: 20px; }
.people-fields:disabled input, .people-fields:disabled textarea, .people-fields:disabled select { color: var(--text); opacity: 1; background: var(--ground); }
.full { grid-column: 1 / -1; }
.permission-option { align-items: flex-start; }
.permission-option strong, .permission-option small { display: block; overflow-wrap: anywhere; }
.permission-option small { margin-top: 4px; }
.form-section h2 { font-size: 16px; margin-bottom: 8px; }
.policy-note { font-size: 13px; }
.borrowing-control { display: grid; justify-items: start; gap: 12px; margin-top: 20px; }
.borrowing-control .field { width: 100%; }
@media (max-width: 640px) { .people-pagination { align-items: flex-start; flex-direction: column; } .page-head { align-items: flex-start; } .people-dialog { max-height: 95dvh; } }
</style>
