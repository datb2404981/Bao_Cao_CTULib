<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { request } from '../../services/request'
import { refreshAuthorization } from '../../services/auth'

interface Profile {
  ctuIdentifier: string; email: string; role: string; createdAt?: string; hasProfile: boolean
  fullName: string; phoneNumber: string; address: string; dateOfBirth: string
  readerType: string; facultyName: string; position: string
}
type EditableField = 'fullName' | 'phoneNumber' | 'address' | 'email'
const props = defineProps<{ busy: boolean; signOutError: string }>()
defineEmits<{ signOut: [] }>()
const profile = ref<Profile | null>(null)
const loading = ref(true)
const saving = ref(false)
const editingField = ref<EditableField | null>(null)
const draft = ref('')
const editingInput = ref<HTMLInputElement | null>(null)
let pendingField: EditableField | null = null
const notice = ref('')
const error = ref('')
const roles: Record<string, string> = { READER: 'Bạn đọc', EMPLOYEE: 'Nhân viên', ADMIN: 'Quản trị viên' }
const readerTypes: Record<string, string> = { STUDENT: 'Sinh viên', POSTGRADUATE: 'Học viên sau đại học', STAFF: 'Cán bộ' }
function fill(data: Profile) {
  profile.value = data
}
async function load() {
  loading.value = true
  error.value = ''
  try { fill(await request<Profile>('/api/v1/auth/profile')) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không thể tải hồ sơ.' }
  finally { loading.value = false }
}
function startEdit(field: EditableField) {
  if (!profile.value || (field !== 'email' && !profile.value.hasProfile)) return
  if (saving.value || editingField.value) {
    if (editingField.value !== field) {
      pendingField = field
      if (!saving.value) void saveField()
    }
    return
  }
  editingField.value = field
  draft.value = profile.value[field]
  notice.value = error.value = ''
  void nextTick(() => editingInput.value?.focus())
}
function openPendingField() {
  if (!pendingField) return
  const field = pendingField
  pendingField = null
  startEdit(field)
}
function cancelEdit() {
  if (saving.value) return
  editingField.value = null
  pendingField = null
  error.value = ''
}
async function saveField() {
  if (!profile.value || !editingField.value || saving.value) return
  const field = editingField.value
  const value = draft.value.trim()
  if (value === profile.value[field]) {
    editingField.value = null
    openPendingField()
    return
  }
  if (field === 'fullName' && value.length < 2) {
    error.value = 'Họ và tên cần ít nhất 2 ký tự.'
    pendingField = null
    void nextTick(() => editingInput.value?.focus())
    return
  }
  if (field === 'email' && (!value || !editingInput.value?.checkValidity())) {
    error.value = 'Email không đúng định dạng.'
    pendingField = null
    void nextTick(() => editingInput.value?.focus())
    return
  }
  saving.value = true
  notice.value = error.value = ''
  try {
    const body = field === 'email'
      ? { email: value }
      : { fullName: profile.value.fullName, phoneNumber: profile.value.phoneNumber, address: profile.value.address, [field]: value }
    fill(await request<Profile>(`/api/v1/auth/profile/${field === 'email' ? 'email' : 'personal'}`, 'PATCH', body))
    editingField.value = null
    if (field === 'email') {
      try { await refreshAuthorization() } catch { /* Hồ sơ đã lưu; phiên sẽ được đồng bộ lần kiểm tra tiếp theo. */ }
    }
    notice.value = 'Thông tin đã được cập nhật.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không thể cập nhật thông tin.'
    pendingField = null
    void nextTick(() => editingInput.value?.focus())
  } finally {
    saving.value = false
    if (!editingField.value) openPendingField()
  }
}
onMounted(load)
</script>

<template>
  <div class="profile-page">
    <div class="profile-page-heading"><div><p class="profile-eyebrow">TÀI KHOẢN CỦA BẠN</p><h1>Hồ sơ cá nhân</h1><p>Quản lý thông tin và kết nối với thư viện của bạn.</p></div></div>
    <div v-if="loading" class="profile-loading" role="status">Đang tải hồ sơ…</div>
    <div v-else-if="!profile" class="profile-loading"><p role="alert">{{ error }}</p><button class="profile-button secondary" @click="load">Thử lại</button></div>
    <template v-else>
      <div v-if="saving" class="profile-saving" role="status">Đang lưu thay đổi…</div>
      <div v-if="notice" class="profile-notice" role="status">{{ notice }}</div>
      <div v-if="error || signOutError" class="profile-error" role="alert">{{ error || signOutError }}</div>
      <div class="profile-grid">
        <aside class="profile-sidebar-card">
          <div class="profile-avatar">{{ (profile.fullName || profile.ctuIdentifier).slice(0, 2).toUpperCase() }}</div>
          <span class="profile-role">{{ roles[profile.role] || profile.role }}</span>
          <h2>{{ profile.fullName || profile.ctuIdentifier }}</h2>
          <p>{{ profile.ctuIdentifier }}</p>
          <div class="profile-sidebar-divider"></div>
          <div class="profile-sidebar-info"><span>Thành viên từ</span><strong>{{ profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('vi-VN') : 'Chưa cập nhật' }}</strong></div>
          <div class="profile-sidebar-info"><span>Trạng thái</span><strong class="profile-active">● Đang hoạt động</strong></div>
          <button class="profile-signout" type="button" :disabled="props.busy" @click="$emit('signOut')">{{ props.busy ? 'Đang đăng xuất…' : 'Đăng xuất' }} <span aria-hidden="true">↗</span></button>
        </aside>
        <div class="profile-main">
          <section class="profile-section">
            <div class="profile-section-heading">
              <div>
                <p class="profile-kicker">THÔNG TIN CÁ NHÂN</p>
                <h2>Thông tin của bạn</h2>
                <p>{{ profile.hasProfile ? 'Nhấn vào thông tin để sửa.' : 'Những thông tin thư viện sử dụng để liên hệ với bạn.' }}</p>
              </div>
            </div>
            <p v-if="!profile.hasProfile" class="profile-hint">Hồ sơ cá nhân chưa được tạo. Vui lòng liên hệ thư viện để được hỗ trợ.</p>
            <dl class="profile-details">
              <div>
                <dt id="profile-full-name-label">Họ và tên</dt>
                <dd>
                  <input v-if="editingField === 'fullName'" ref="editingInput" v-model="draft" class="profile-inline-input" aria-labelledby="profile-full-name-label" :aria-invalid="Boolean(error)" :readonly="saving" autocomplete="name" required minlength="2" maxlength="50" @input="error = ''" @blur="saveField" @keydown.enter.prevent="saveField" @keydown.esc.prevent="cancelEdit">
                  <button v-else-if="profile.hasProfile" type="button" class="profile-inline-value" :class="{ 'profile-inline-empty': !profile.fullName }" :aria-label="'Sửa họ và tên: ' + (profile.fullName || 'Chưa cập nhật')" @click="startEdit('fullName')">
                    <span>{{ profile.fullName || 'Chưa cập nhật' }}</span>
                    <svg class="profile-edit-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                  </button>
                  <span v-else>Chưa cập nhật</span>
                </dd>
              </div>
              <div>
                <dt id="profile-phone-label">Số điện thoại</dt>
                <dd>
                  <input v-if="editingField === 'phoneNumber'" ref="editingInput" v-model="draft" class="profile-inline-input" aria-labelledby="profile-phone-label" :aria-invalid="Boolean(error)" :readonly="saving" autocomplete="tel" type="tel" maxlength="30" placeholder="Nhập số điện thoại" @input="error = ''" @blur="saveField" @keydown.enter.prevent="saveField" @keydown.esc.prevent="cancelEdit">
                  <button v-else-if="profile.hasProfile" type="button" class="profile-inline-value" :class="{ 'profile-inline-empty': !profile.phoneNumber }" :aria-label="'Sửa số điện thoại: ' + (profile.phoneNumber || 'Chưa cập nhật')" @click="startEdit('phoneNumber')">
                    <span>{{ profile.phoneNumber || 'Chưa cập nhật' }}</span>
                    <svg class="profile-edit-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                  </button>
                  <span v-else>Chưa cập nhật</span>
                </dd>
              </div>
              <div class="profile-wide">
                <dt id="profile-address-label">Địa chỉ</dt>
                <dd>
                  <input v-if="editingField === 'address'" ref="editingInput" v-model="draft" class="profile-inline-input" aria-labelledby="profile-address-label" :aria-invalid="Boolean(error)" :readonly="saving" autocomplete="street-address" maxlength="250" placeholder="Nhập địa chỉ" @input="error = ''" @blur="saveField" @keydown.enter.prevent="saveField" @keydown.esc.prevent="cancelEdit">
                  <button v-else-if="profile.hasProfile" type="button" class="profile-inline-value" :class="{ 'profile-inline-empty': !profile.address }" :aria-label="'Sửa địa chỉ: ' + (profile.address || 'Chưa cập nhật')" @click="startEdit('address')">
                    <span>{{ profile.address || 'Chưa cập nhật' }}</span>
                    <svg class="profile-edit-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                  </button>
                  <span v-else>Chưa cập nhật</span>
                </dd>
              </div>
              <div v-if="profile.dateOfBirth"><dt>Ngày sinh</dt><dd>{{ profile.dateOfBirth.split('-').reverse().join('/') }}</dd></div>
              <div v-if="profile.readerType"><dt>Loại bạn đọc</dt><dd>{{ readerTypes[profile.readerType] || profile.readerType }}</dd></div>
              <div v-if="profile.facultyName"><dt>Khoa / viện</dt><dd>{{ profile.facultyName }}</dd></div>
              <div v-if="profile.position"><dt>Chức vụ</dt><dd>{{ profile.position }}</dd></div>
            </dl>
          </section>
          <section class="profile-section">
            <div class="profile-section-heading"><div><p class="profile-kicker">TÀI KHOẢN</p><h2>Thông tin đăng nhập</h2><p>Thông tin định danh và email liên kết với tài khoản.</p></div></div>
            <dl class="profile-details">
              <div><dt>Mã định danh</dt><dd>{{ profile.ctuIdentifier }}</dd></div>
              <div><dt>Vai trò</dt><dd>{{ roles[profile.role] || profile.role }}</dd></div>
              <div class="profile-wide">
                <dt id="profile-email-label">Địa chỉ email</dt>
                <dd>
                  <input v-if="editingField === 'email'" ref="editingInput" v-model="draft" class="profile-inline-input" aria-labelledby="profile-email-label" :aria-invalid="Boolean(error)" :readonly="saving" type="email" required maxlength="254" autocomplete="email" @input="error = ''" @blur="saveField" @keydown.enter.prevent="saveField" @keydown.esc.prevent="cancelEdit">
                  <button v-else type="button" class="profile-inline-value" :aria-label="'Sửa địa chỉ email: ' + profile.email" @click="startEdit('email')">
                    <span>{{ profile.email }}</span>
                    <svg class="profile-edit-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                  </button>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
