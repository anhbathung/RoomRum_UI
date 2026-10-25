import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Home } from 'lucide-react'
import { api, json } from '../../shared/api/client'
import { useAuth } from '../../shared/ui'
import type { Role, Session } from '../../shared/types'

type Registration = { userId: string; name: string; email: string | null; role: Role; status: string; emailDelivery: 'Smtp' | 'PickupDirectory' | null }
type VerificationEmail = { message: string; emailDelivery: 'Smtp' | 'PickupDirectory' | null }

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { save } = useAuth(); const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'Tenant' })
  const [propertyImages, setPropertyImages] = useState<File[]>([])
  const [identityDocuments, setIdentityDocuments] = useState<File[]>([])
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { setError(''); setNotice(''); setBusy(false) }, [mode])
  const sendVerification = async () => {
    setError(''); setNotice('')
    if (!form.email.trim() || !form.password) { setError('Nhập email và mật khẩu của tài khoản cần xác thực.'); return }
    setBusy(true)
    try {
      const result = await api<VerificationEmail>('/auth/send-verification-email', json('POST', { email: form.email, password: form.password }))
      setNotice(result.emailDelivery === 'PickupDirectory'
        ? 'Chế độ kiểm thử: thư xác thực đã được lưu cục bộ ở máy chủ, chưa gửi tới hộp thư thật.'
        : result.message)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true)
    try {
      if (mode === 'register') {
        let registration: Registration
        if (form.role === 'Landlord') {
          if (propertyImages.length < 1 || propertyImages.length > 3 || identityDocuments.length < 1 || identityDocuments.length > 2)
            throw new Error('Chọn 1–3 ảnh nhà trọ và 1–2 giấy tờ xác minh.')
          if ([...propertyImages, ...identityDocuments].some(file => file.size === 0 || file.size > 5 * 1024 * 1024))
            throw new Error('Mỗi file phải có nội dung và không vượt quá 5 MB.')
          const payload = new FormData()
          Object.entries(form).forEach(([key, value]) => { if (key !== 'role') payload.append(key, value) })
          propertyImages.forEach(file => payload.append('propertyImages', file))
          identityDocuments.forEach(file => payload.append('identityDocuments', file))
          registration = await api<Registration>('/auth/register/landlord', { method: 'POST', body: payload })
        } else {
          registration = await api<Registration>('/auth/register', json('POST', form))
        }
        save(null)
        setNotice(registration.role === 'Tenant'
          ? registration.emailDelivery === 'PickupDirectory'
            ? 'Chế độ kiểm thử: thư xác thực được lưu cục bộ ở máy chủ, chưa gửi tới hộp thư. Tài khoản chưa kích hoạt.'
            : 'Tài khoản chưa kích hoạt. Hãy mở email xác thực và nhấn đường dẫn trong thời hạn ghi trong thư, sau đó đăng nhập.'
          : 'Đã tạo tài khoản Chủ trọ và lưu hồ sơ xác minh. Bạn có thể đăng nhập.')
        return
      }
      const session = await api<Session>('/auth/login', json('POST', { email: form.email, password: form.password }))
      if (!session?.token) throw new Error('Đăng nhập không trả về phiên hợp lệ.')
      save(session)
      navigate(session.role === 'Admin' ? '/admin' : session.role === 'Landlord' ? '/landlord' : '/tenant')
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  return <div className="auth-page"><div className="auth-visual"><Link to="/" className="auth-brand"><Home size={22} /> RoomRum</Link><div className="auth-visual-copy"><span>KHÔNG GIAN SỐNG CỦA BẠN</span><h1>{mode === 'login' ? 'Mừng bạn trở lại với RoomRum.' : 'Bắt đầu hành trình tìm nơi ở phù hợp.'}</h1><p>Tìm phòng, xem bản đồ và kết nối với chủ phòng trong một trải nghiệm rõ ràng.</p></div><div className="auth-pattern" aria-hidden="true"><div /><div /><div /></div></div><div className="auth-form-wrap"><Link to="/" className="auth-back">← Về trang chủ</Link><form className="auth-form" onSubmit={submit}><span className="section-label">{mode === 'login' ? 'ĐĂNG NHẬP' : 'TẠO TÀI KHOẢN'}</span><h2>{mode === 'login' ? 'Chào mừng trở lại' : 'Tham gia RoomRum'}</h2><p>{mode === 'login' ? 'Đăng nhập để tiếp tục quản lý không gian sống của bạn.' : 'Chọn vai trò phù hợp để bắt đầu.'}</p>{mode === 'register' && <><label>Họ và tên<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nhập họ và tên" /></label><label>Vai trò<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="Tenant">Người thuê</option><option value="Landlord">Chủ trọ</option></select></label></>}<label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ten@example.com" /></label>{mode === 'register' && <label>Số điện thoại (không bắt buộc)<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Số điện thoại" /></label>}<label>Mật khẩu<input required minLength={8} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Ít nhất 8 ký tự" /></label>
    {mode === 'register' && form.role === 'Landlord' && <fieldset className="registration-files"><legend>Hồ sơ Chủ trọ</legend><p id="registration-file-help">Mỗi file tối đa 5 MB. Hồ sơ được lưu riêng với tài khoản, không công khai trên trang phòng.</p><label>Ảnh nhà trọ (1–3 ảnh)<input required type="file" multiple accept=".jpg,.jpeg,.png,.webp" aria-describedby="registration-file-help" onChange={e => setPropertyImages(Array.from(e.target.files || []))} /></label><label>Giấy tờ xác minh (1–2 file)<input required type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" aria-describedby="registration-file-help" onChange={e => setIdentityDocuments(Array.from(e.target.files || []))} /></label></fieldset>}
    {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="form-success" role="status">{notice} {mode === 'register' && <Link to="/login">Đến trang đăng nhập</Link>}</div>}<button className="button button-primary full" disabled={busy || (mode === 'register' && !!notice)}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'} <ArrowRight size={17} /></button>
    {(mode === 'login' || form.role === 'Tenant') && <button type="button" className="button button-outline full" disabled={busy} onClick={sendVerification}>Gửi lại email xác thực</button>}
    <div className="auth-switch">{mode === 'login' ? <>Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></> : <>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></>}</div></form></div></div>
}
