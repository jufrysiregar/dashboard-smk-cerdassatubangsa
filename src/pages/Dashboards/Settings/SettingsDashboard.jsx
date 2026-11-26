import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CinematicLoading from '../../../components/dashboard/shared/CinematicLoading';

import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Info,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MonitorSmartphone,
  Paperclip,
  Phone,
  Trash2,
  UploadCloud,
  User,
  X,
} from 'lucide-react';
import { userAPI, schoolAPI } from '../../../utils/api';
import { fetchQuery, getQueryData, isQueryFresh, setQueryData } from '../../../utils/queryCache';

const PROFILE_CACHE_KEY = 'settings:profile';
const SESSIONS_CACHE_KEY = 'settings:sessions';
const SETTINGS_CACHE_TTL = 60000;

// Kelas input seragam untuk seluruh form Pengaturan (murni tampilan).
const INPUT_CLASS = 'w-full rounded-xl border border-slate-200/90 bg-slate-50/60 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10';

// Profil yang sudah tersimpan saat login dipakai sebagai data awal, sehingga
// menu ini langsung tampil tanpa layar loading ketika dibuka ulang.
const readSessionUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const WhatsAppIcon = ({ className }) => (
  <svg className={className} stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157.1zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"></path>
  </svg>
);

const Card = ({ children, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    className={`overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_12px_36px_-12px_rgba(15,23,42,0.06)] transition-all hover:shadow-[0_16px_40px_-12px_rgba(15,23,42,0.1)] sm:p-8 ${className}`}
  >
    {children}
  </motion.div>
);

const Badge = ({ tone = 'slate', children }) => {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
};

const SectionHeading = ({ kicker, title, description }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{kicker}</p>
    <h3 className="mt-1 text-xl font-bold text-slate-900">{title}</h3>
    {description ? <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-slate-500">{description}</p> : null}
  </div>
);

const formatDateTime = (value) => {
  if (!value) return 'Belum tercatat';

  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const inferSettingsGroup = (user) => {
  if (!user) return 'pimpinan_staf_tetap';
  if (user.settingsGroup) return user.settingsGroup;
  return user.accessRole === 'murid' || ['honorer', 'magang'].includes(user.positionStatus)
    ? 'murid_tenaga_lepas'
    : 'pimpinan_staf_tetap';
};

const buildDisplayName = (profile) => [profile?.name, profile?.academicTitle].filter(Boolean).join(', ') || profile?.name || '-';

// Aturan kekuatan password (murni tampilan/feedback): min 6 karakter, 1 huruf besar,
// 1 huruf kecil, 1 karakter spesial.
const PASSWORD_RULES = [
  { key: 'len', label: 'Minimal 8 karakter', test: (v) => v.length >= 8 },
  { key: 'upper', label: '1 huruf besar (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: '1 huruf kecil (a-z)', test: (v) => /[a-z]/.test(v) },
  { key: 'special', label: '1 karakter spesial', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const evaluatePassword = (value) => {
  const met = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(value) }));
  const score = met.filter((r) => r.ok).length; // 0-4
  const level = value.length === 0 ? 'empty' : score <= 1 ? 'weak' : score <= 3 ? 'fair' : 'strong';
  return { met, score, level };
};

const STRENGTH_META = {
  empty: { label: '', bar: 'bg-slate-200', text: 'text-slate-400', pct: 0 },
  weak: { label: 'Kurang kuat', bar: 'bg-rose-500', text: 'text-rose-600', pct: 25 },
  fair: { label: 'Lemah — hati-hati', bar: 'bg-amber-500', text: 'text-amber-600', pct: 60 },
  strong: { label: 'Kuat', bar: 'bg-emerald-500', text: 'text-emerald-600', pct: 100 },
};

// Meter kekuatan + checklist syarat password (komponen presentasional).
const PasswordStrengthMeter = ({ value }) => {
  const { met, level } = evaluatePassword(value);
  const meta = STRENGTH_META[level];
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Kekuatan</span>
        {meta.label ? <span className={`text-[10px] font-bold ${meta.text}`}>{meta.label}</span> : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-300 ${meta.bar}`} style={{ width: `${meta.pct}%` }} />
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {met.map((r) => (
          <li key={r.key} className={`flex items-center gap-1 text-[10px] font-semibold ${r.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
            {r.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

const SCHOOL_FIELD_DEFS = [
  { key: 'school_name', label: 'Nama Sekolah', placeholder: 'SMK Cerdas Satu Bangsa' },
  { key: 'school_address', label: 'Alamat', placeholder: 'Jalan / kelurahan / kota lengkap' },
  { key: 'school_phone', label: 'Telepon', placeholder: '(061) 555-0111' },
  { key: 'school_email', label: 'Email', placeholder: 'sekolah@contoh.sch.id' },
  { key: 'school_npsn', label: 'NPSN', placeholder: '6072XXXX' },
  { key: 'school_city', label: 'Kota', placeholder: 'Medan' },
];

/**
 * Profil resmi sekolah — sumber kop surat rapor & dokumen resmi (disimpan di
 * system_settings key school_*). Hanya operator/admin akademik yang boleh ubah.
 * Nilai kosong di DB tampil '-' pada PDF (tanpa placeholder dummy).
 */
function SchoolProfileSection({ pushToast }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    schoolAPI.getProfile()
      .then((r) => {
        if (!alive) return;
        const d = r.data?.data || {};
        const values = {};
        SCHOOL_FIELD_DEFS.forEach((f) => { values[f.key] = d[f.key] || ''; });
        setForm(values);
        setSaved(values);
      })
      .catch(() => { if (alive) pushToast('Gagal memuat profil sekolah.', 'error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [pushToast]);

  const dirty = useMemo(() => {
    if (!form || !saved) return false;
    return SCHOOL_FIELD_DEFS.some((f) => (form[f.key] || '').trim() !== (saved[f.key] || '').trim());
  }, [form, saved]);

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const payload = {};
      SCHOOL_FIELD_DEFS.forEach((f) => { payload[f.key] = (form[f.key] || '').trim(); });
      const res = await schoolAPI.updateProfile(payload);
      const normalized = {};
      SCHOOL_FIELD_DEFS.forEach((f) => { normalized[f.key] = res.data?.data?.[f.key] || ''; });
      setForm(normalized);
      setSaved(normalized);
      pushToast(res.data?.message || 'Profil sekolah berhasil disimpan.');
    } catch (error) {
      pushToast(error?.response?.data?.message || 'Gagal menyimpan profil sekolah.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-6">
      <div className="-mx-6 -mt-6 mb-2 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-cyan-100 via-teal-100 to-emerald-100 px-6 py-5 sm:-mx-8 sm:-mt-8 sm:px-8">
        <h3 className="text-lg font-bold text-slate-900">Update Data Profil Sekolah</h3>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-slate-700 ring-1 ring-slate-200">
          <GraduationCap className="h-5 w-5" />
        </span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat profil sekolah...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SCHOOL_FIELD_DEFS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-900">{f.label}</span>
                <input
                  type="text"
                  value={form?.[f.key] || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className={INPUT_CLASS}
                />
              </label>
            ))}
          </div>
          <div className="flex items-center justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                dirty && !saving
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-600/20'
                  : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Menyimpan...' : 'Simpan Profil Sekolah'}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

export default function SettingsDashboard({ user, onUserUpdate }) {
  const seedProfile = useMemo(
    () => getQueryData(PROFILE_CACHE_KEY) || readSessionUser() || null,
    [],
  );

  const [profile, setProfile] = useState(() => seedProfile);
  const [sessions, setSessions] = useState(() => getQueryData(SESSIONS_CACHE_KEY) || []);
  const [loading, setLoading] = useState(() => !seedProfile);
  const [busyKey, setBusyKey] = useState('');
  const [toast, setToast] = useState(null);
  const [identityForm, setIdentityForm] = useState(() => ({
    name: seedProfile?.name || '',
    academicTitle: seedProfile?.academicTitle || '',
  }));
  const [contactForm, setContactForm] = useState(() => ({
    phone: seedProfile?.phone || '',
    whatsapp: seedProfile?.whatsapp || '',
    email: seedProfile?.email || '',
  }));
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwReveal, setPwReveal] = useState({ current: false, newPw: false, confirm: false });
  const [showPwHint, setShowPwHint] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(() => seedProfile?.avatarUrl || '');
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(() => seedProfile?.signatureUrl || '');

  const avatarInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  const evaluatedUser = profile || user || {};
  const sysRole = evaluatedUser.accessRole || evaluatedUser.role;
  const sysPos = evaluatedUser.positionStatus;

  const isGuru = sysRole === 'guru';
  const isKepsekWakasek = sysRole === 'kepala_sekolah' || sysRole === 'wakil_sekolah';
  const isOperator = sysRole === 'operator' || sysRole === 'admin_akademik';
  const isMurid = sysRole === 'murid';
  const isKasir = sysRole === 'cashier' || sysRole === 'kasir';
  const isPusatJurusan = sysRole === 'pusat_jurusan';
  
  const isHonorerMagang = ['honorer', 'magang'].includes(sysPos);

  const canUploadAvatar = true;
  const canUploadTTD = false;
  
  const settingsGroup = useMemo(() => inferSettingsGroup(profile || user), [profile, user]);
  const isLimitedGroup = settingsGroup === 'murid_tenaga_lepas' && !isOperator;

  const isIdentityChanged = useMemo(() => (
    identityForm.name.trim() !== (profile?.name || '') ||
    identityForm.academicTitle.trim() !== (profile?.academicTitle || '')
  ), [identityForm, profile]);

  const isContactChanged = useMemo(() => (
    contactForm.phone.trim() !== (profile?.phone || '') ||
    contactForm.whatsapp.trim() !== (profile?.whatsapp || '') ||
    contactForm.email.trim() !== (profile?.email || '')
  ), [contactForm, profile]); 

  const pushToast = (message, type = 'success') => {
    setToast({ message, type });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  };

  const syncUserSession = (nextProfile) => {
    const cachedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const mergedUser = { ...cachedUser, ...nextProfile };
    sessionStorage.setItem('user', JSON.stringify(mergedUser));
    onUserUpdate?.(mergedUser);
  };

  const replacePreview = (setter, nextUrl, currentUrl) => {
    if (currentUrl?.startsWith('blob:')) URL.revokeObjectURL(currentUrl);
    setter(nextUrl);
  };

  // Hanya sinkronkan ulang isian form bila pengguna belum mengubahnya,
  // supaya penyegaran di latar belakang tidak menimpa ketikan.
  const applyProfile = (nextProfile, { syncForms = true } = {}) => {
    const previous = profile || {};
    const isFormUntouched =
      identityForm.name.trim() === (previous.name || '').trim() &&
      identityForm.academicTitle.trim() === (previous.academicTitle || '').trim() &&
      contactForm.phone.trim() === (previous.phone || '').trim() &&
      contactForm.whatsapp.trim() === (previous.whatsapp || '').trim() &&
      contactForm.email.trim() === (previous.email || '').trim();

    setProfile(nextProfile);

    if (syncForms && isFormUntouched) {
      setIdentityForm({
        name: nextProfile.name || '',
        academicTitle: nextProfile.academicTitle || '',
      });
      setContactForm({
        phone: nextProfile.phone || '',
        whatsapp: nextProfile.whatsapp || '',
        email: nextProfile.email || '',
      });
      replacePreview(setAvatarPreview, nextProfile.avatarUrl || '', avatarPreview);
      replacePreview(setSignaturePreview, nextProfile.signatureUrl || '', signaturePreview);
      setAvatarFile(null);
      setSignatureFile(null);
    }

    syncUserSession(nextProfile);
  };

  const applySessions = (nextSessions) => {
    setSessions(nextSessions);
    setQueryData(SESSIONS_CACHE_KEY, nextSessions);
  };

  const loadSettings = async ({ silent = false } = {}) => {
    const cachedProfileData = getQueryData(PROFILE_CACHE_KEY);
    const cachedSessionsData = getQueryData(SESSIONS_CACHE_KEY);

    if (cachedProfileData) applyProfile(cachedProfileData);
    if (cachedSessionsData) setSessions(cachedSessionsData);

    // Masih segar: cukup pakai cache, tidak perlu menyentuh server.
    if (
      cachedProfileData && cachedSessionsData &&
      isQueryFresh(PROFILE_CACHE_KEY, SETTINGS_CACHE_TTL) &&
      isQueryFresh(SESSIONS_CACHE_KEY, SETTINGS_CACHE_TTL)
    ) {
      setLoading(false);
      return;
    }

    try {
      if (!silent && !profile) setLoading(true);
      const [nextProfile, nextSessions] = await Promise.all([
        fetchQuery(PROFILE_CACHE_KEY, async () => (await userAPI.getProfile()).data.user),
        fetchQuery(SESSIONS_CACHE_KEY, async () => (await userAPI.getSessions()).data.data || []),
      ]);

      applyProfile(nextProfile);
      applySessions(nextSessions);
    } catch (error) {
      pushToast(error.response?.data?.message || 'Menu pengaturan gagal dimuat.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
      pushToast('Foto profil hanya mendukung format JPG dan PNG.', 'error');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      pushToast('Ukuran foto maksimal 5MB.', 'error');
      event.target.value = '';
      return;
    }

    setAvatarFile(file);
    replacePreview(setAvatarPreview, URL.createObjectURL(file), avatarPreview);
  };

  // Batalkan foto yang baru dipilih sebelum disimpan (kembalikan ke avatar tersimpan).
  const handleAvatarCancel = () => {
    replacePreview(setAvatarPreview, profile?.avatarUrl || '', avatarPreview);
    setAvatarFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleSignatureChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
      pushToast('Tanda tangan hanya mendukung format JPG dan PNG.', 'error');
      event.target.value = '';
      return;
    }

    setSignatureFile(file);
    replacePreview(setSignaturePreview, URL.createObjectURL(file), signaturePreview);
  };

  const handleIdentitySave = async () => {
    try {
      setBusyKey('identity');
      const formData = new FormData();
      formData.append('name', identityForm.name.trim());
      formData.append('academicTitle', identityForm.academicTitle.trim());

      const response = await userAPI.updateProfile(formData);
      applyProfile(response.data.user);
      pushToast('Profil utama berhasil diperbarui.');
    } catch (error) {
      pushToast(error.response?.data?.message || 'Profil gagal diperbarui.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const handleContactSave = async () => {
    try {
      setBusyKey('contact');
      const formData = new FormData();
      formData.append('phone', contactForm.phone.trim());
      formData.append('whatsapp', contactForm.whatsapp.trim());

      if (!isLimitedGroup && !isGuru) {
        formData.append('email', contactForm.email.trim());
      }

      const response = await userAPI.updateProfile(formData);
      applyProfile(response.data.user);
      pushToast('Kontak aktif berhasil diperbarui.');
    } catch (error) {
      pushToast(error.response?.data?.message || 'Kontak gagal diperbarui.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const handleAvatarSave = async () => {
    if (!avatarFile) {
      pushToast('Pilih foto profil terlebih dahulu.', 'error');
      return;
    }

    try {
      setBusyKey('avatar');
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      const response = await userAPI.updateProfile(formData);
      applyProfile(response.data.user);
      pushToast('Foto profil berhasil diperbarui.');
    } catch (error) {
      pushToast(error.response?.data?.message || 'Foto profil gagal diperbarui.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const handleAvatarDelete = async () => {
    try {
      setBusyKey('avatar-delete');
      const response = await userAPI.deleteAvatar();
      applyProfile(response.data.user);
      pushToast('Foto profil berhasil dihapus.');
    } catch (error) {
      pushToast(error.response?.data?.message || 'Foto profil gagal dihapus.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const handleSignatureSave = async () => {
    if (!signatureFile) {
      pushToast('Pilih file tanda tangan terlebih dahulu.', 'error');
      return;
    }

    try {
      setBusyKey('signature');
      const formData = new FormData();
      formData.append('signature', signatureFile);

      const response = await userAPI.updateProfile(formData);
      applyProfile(response.data.user);
      pushToast('Tanda tangan basah berhasil diperbarui.');
    } catch (error) {
      pushToast(error.response?.data?.message || 'Tanda tangan gagal diperbarui.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const handlePasswordSave = async () => {
    try {
      setBusyKey('password');
      await userAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        newPassword_confirmation: passwordForm.confirmPassword,
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      const sessionsResponse = await userAPI.getSessions();
      applySessions(sessionsResponse.data.data || []);
      pushToast('Password berhasil diganti.');
    } catch (error) {
      pushToast(error.response?.data?.message || 'Password gagal diganti.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const handleDeleteLog = async (id) => {
    try {
      setBusyKey(`delete-${id}`);
      await userAPI.revokeSession(id);
      const sessionsResponse = await userAPI.getSessions();
      applySessions(sessionsResponse.data.data || []);
      pushToast('Log login berhasil dihapus.');
    } catch (error) {
      pushToast('Gagal menghapus log login.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const handleLogoutOthers = async () => {
    try {
      setBusyKey('sessions');
      const response = await userAPI.logoutOtherDevices();
      const sessionsResponse = await userAPI.getSessions();
      applySessions(sessionsResponse.data.data || []);
      pushToast(response.data.message || 'Perangkat lain berhasil dikeluarkan.');
    } catch (error) {
      pushToast(error.response?.data?.message || 'Gagal mengeluarkan perangkat lain.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  useEffect(() => {
    // Kalau sudah ada data awal, penyegaran dilakukan diam-diam (tanpa layar loading).
    loadSettings({ silent: Boolean(seedProfile) });

    return () => {
      window.clearTimeout(toastTimerRef.current);
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
      if (signaturePreview?.startsWith('blob:')) URL.revokeObjectURL(signaturePreview);
    };
  }, []);

  if (loading && !profile) {
    return <CinematicLoading roleName="Pengaturan" title="Memuat Pengaturan Akun" />;
  }

  const sessionCount = sessions.length;

  return (
    <div className="relative flex flex-col gap-8 pb-20">
      {/* Hidden file inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        className="hidden"
        onChange={handleAvatarChange}
      />
      {canUploadTTD && (
        <input
          ref={signatureInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          className="hidden"
          onChange={handleSignatureChange}
        />
      )}

      <div className="relative -mx-2 overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.25),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.96))] px-6 py-12 text-center sm:-mx-3">
        <div className="relative flex flex-col items-center justify-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Pengaturan Profil</h1>
          <p className="mt-3 whitespace-nowrap text-sm font-medium text-slate-300 sm:text-base">Harap memberikan informasi yang benar dan periksa <em>input</em>-an sebelum disimpan</p>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-6">
          <div className="-mx-6 -mt-6 mb-2 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-cyan-100 via-teal-100 to-emerald-100 px-6 py-5 sm:-mx-8 sm:-mt-8 sm:px-8">
            <h3 className="text-lg font-bold text-slate-900">Identitas Pribadi</h3>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-slate-700 ring-1 ring-slate-200">
              <User className="h-5 w-5" />
            </span>
          </div>

          {isLimitedGroup ? (
            <div className="space-y-5">
              {canUploadAvatar && (
                <div className="mb-6 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
                  <p className="mb-4 flex items-center gap-2 text-sm font-black text-slate-800">
                    <User className="h-4 w-4 text-slate-400" /> Upload Foto Profil
                  </p>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="relative flex-shrink-0">
                      <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-4 ring-slate-100">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Preview foto profil" className="h-full w-full object-cover" />
                        ) : (
                          <Camera className="h-8 w-8 text-slate-300" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-md transition-all hover:bg-emerald-700"
                        title="Pilih foto"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-medium leading-relaxed text-slate-500">
                        Upload foto format <span className="font-black text-slate-700">JPG/PNG</span>.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleAvatarSave}
                          disabled={busyKey === 'avatar' || !avatarFile}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busyKey === 'avatar' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Simpan Foto
                        </button>
                        <button
                          type="button"
                          onClick={handleAvatarDelete}
                          disabled={busyKey === 'avatar-delete' || !profile?.avatarUrl}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200/70 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {busyKey === 'avatar-delete' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Hapus Foto Saya
                        </button>
                      </div>
                      {avatarFile && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5"><span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-indigo-600"><Paperclip className="h-3 w-3 shrink-0" /> <span className="truncate">{avatarFile.name}</span></span><button type="button" onClick={handleAvatarCancel} className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Batalkan foto"><X className="h-3.5 w-3.5" /></button></div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Nama Lengkap Anda</p>
                  <p className="mt-2 text-lg font-black text-slate-900">{profile?.name || '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">ID Login Akun</p>
                  <p className="mt-2 text-lg font-black text-slate-900">{profile?.schoolId || '-'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-5">
              {/* Upload Foto - sama seperti murid/honorer */}
              {canUploadAvatar && (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
                  <p className="mb-4 flex items-center gap-2 text-sm font-black text-slate-800">
                    <User className="h-4 w-4 text-slate-400" /> Upload Foto Profil
                  </p>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="relative flex-shrink-0">
                      <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-4 ring-slate-100">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Preview foto profil" className="h-full w-full object-cover" />
                        ) : (
                          <Camera className="h-8 w-8 text-slate-300" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-md transition-all hover:bg-emerald-700"
                        title="Pilih foto"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-medium leading-relaxed text-slate-500">
                        Upload foto format <span className="font-black text-slate-700">JPG/PNG</span>, maks 5MB.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleAvatarSave}
                          disabled={busyKey === 'avatar' || !avatarFile}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busyKey === 'avatar' ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3 w-3" />}
                          Simpan Foto
                        </button>
                        <button
                          type="button"
                          onClick={handleAvatarDelete}
                          disabled={busyKey === 'avatar-delete' || !profile?.avatarUrl}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200/70 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {busyKey === 'avatar-delete' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Hapus Foto Saya
                        </button>
                      </div>
                      {avatarFile && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5"><span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-indigo-600"><Paperclip className="h-3 w-3 shrink-0" /> <span className="truncate">{avatarFile.name}</span></span><button type="button" onClick={handleAvatarCancel} className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Batalkan foto"><X className="h-3.5 w-3.5" /></button></div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-800">Nama Lengkap dan Gelar Anda</span>
                <input
                  type="text"
                  value={identityForm.name}
                  onChange={(event) => setIdentityForm((current) => ({ ...current, name: event.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="Contoh: Budi Santoso, S.Pd"
                />
              </label>

              <div className="rounded-xl border border-sky-200/70 bg-sky-50/70 p-4 text-sm font-medium leading-relaxed text-sky-900">
                Nama yang akan tampil di dokumen: <span className="font-black">{buildDisplayName({ ...profile, ...identityForm })}</span>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleIdentitySave}
                  disabled={busyKey === 'identity' || !isIdentityChanged}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busyKey === 'identity' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Simpan Profil
                </button>
              </div>
            </div>
          )}
        </Card>

        <Card className="space-y-6">
          <div className="-mx-6 -mt-6 mb-2 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-cyan-100 via-teal-100 to-emerald-100 px-6 py-5 sm:-mx-8 sm:-mt-8 sm:px-8">
            <h3 className="text-lg font-bold text-slate-900">Kontak Pribadi</h3>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-slate-700 ring-1 ring-slate-200">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </div>

          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-black text-slate-800">
                  <Phone className="h-4 w-4 text-slate-500" /> No. Telp/HP
                </span>
                <input
                  type="text"
                  value={contactForm.phone}
                  onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="Contoh: 0812xxxxxxxx"
                />
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-black text-slate-800">
                  <WhatsAppIcon className="h-4 w-4 text-emerald-500" /> No. WhatsApp
                </span>
                <input
                  type="text"
                  value={contactForm.whatsapp}
                  onChange={(event) => setContactForm((current) => ({ ...current, whatsapp: event.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="Contoh: 0812xxxxxxxx"
                />
              </label>
            </div>

            {(isLimitedGroup || isGuru) ? (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                <p className="flex items-center gap-2 text-sm font-black text-slate-800">
                  <Mail className="h-4 w-4 text-slate-500" /> Email akun
                </p>
                <p className="mt-2 text-sm font-medium text-slate-500">{profile?.email || 'Belum tersedia di akun ini'}</p>
                <p className="mt-1 text-xs font-medium text-slate-400">Perubahan email melalui Operator Sekolah.</p>
              </div>
            ) : (
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-black text-slate-800">
                  <Mail className="h-4 w-4 text-slate-500" /> Email aktif
                </span>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="nama@gmail.com"
                />
              </label>
            )}

            <div>
              <button
                type="button"
                onClick={handleContactSave}
                disabled={busyKey === 'contact' || !isContactChanged}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyKey === 'contact' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan Kontak
              </button>
            </div>
          </div>
        </Card>
      </div>


      <div className="grid gap-8">
        <Card className="space-y-6">
          <div className="-mx-6 -mt-6 mb-2 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-cyan-100 via-teal-100 to-emerald-100 px-6 py-5 sm:-mx-8 sm:-mt-8 sm:px-8">
            <h3 className="text-lg font-bold text-slate-900">Keamanan Akun Pribadi</h3>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-slate-700 ring-1 ring-slate-200">
              <KeyRound className="h-5 w-5" />
            </span>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="grid gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-black text-slate-800">Password lama</span>
                    <div className="relative">
                      <input
                        type={pwReveal.current ? 'text' : 'password'}
                        value={passwordForm.currentPassword}
                        onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                        className={`${INPUT_CLASS} pr-11`}
                        placeholder="Masukkan password lama"
                      />
                      <button
                        type="button"
                        aria-label="Tahan untuk melihat password"
                        onMouseDown={() => setPwReveal((p) => ({ ...p, current: true }))}
                        onMouseUp={() => setPwReveal((p) => ({ ...p, current: false }))}
                        onMouseLeave={() => setPwReveal((p) => ({ ...p, current: false }))}
                        onTouchStart={() => setPwReveal((p) => ({ ...p, current: true }))}
                        onTouchEnd={() => setPwReveal((p) => ({ ...p, current: false }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600 select-none"
                      >
                        {pwReveal.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>

                  <label className="space-y-2">
                    <div
                      className="flex items-center gap-2"
                      onMouseEnter={() => setShowPwHint(true)}
                      onMouseLeave={() => setShowPwHint(false)}
                    >
                      <span className="text-sm font-black text-slate-800">Password baru</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowPwHint((v) => !v)}
                          aria-label="Info keamanan password"
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            showPwHint
                              ? 'border-rose-500 bg-rose-500 text-white'
                              : 'border-slate-300 text-slate-400 hover:border-rose-400 hover:text-rose-500'
                          }`}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                        {showPwHint ? (
                          <div className="absolute left-0 top-full z-30 mt-2 w-[560px] max-w-[calc(100vw-2rem)] rounded-xl bg-slate-900 px-4 py-3 text-[13px] font-medium leading-relaxed text-white shadow-2xl">
                            Hindari memasukkan password di tempat ramai untuk mencegah penyalahgunaan. Pastikan Anda mengingat dan menyimpan password di tempat yang aman untuk login berikutnya, karena permintaan reset password melalui operator dibatasi <span className="font-bold">maksimal 3 kali dalam satu semester</span>.
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type={pwReveal.newPw ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                        className={`${INPUT_CLASS} pr-11`}
                        placeholder="Minimal 8 karakter"
                      />
                      <button
                        type="button"
                        aria-label="Tahan untuk melihat password"
                        onMouseDown={() => setPwReveal((p) => ({ ...p, newPw: true }))}
                        onMouseUp={() => setPwReveal((p) => ({ ...p, newPw: false }))}
                        onMouseLeave={() => setPwReveal((p) => ({ ...p, newPw: false }))}
                        onTouchStart={() => setPwReveal((p) => ({ ...p, newPw: true }))}
                        onTouchEnd={() => setPwReveal((p) => ({ ...p, newPw: false }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600 select-none"
                      >
                        {pwReveal.newPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordStrengthMeter value={passwordForm.newPassword} />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-black text-slate-800">Konfirmasi baru</span>
                    <div className="relative">
                      <input
                        type={pwReveal.confirm ? 'text' : 'password'}
                        value={passwordForm.confirmPassword}
                        onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                        className={`${INPUT_CLASS} pr-11`}
                        placeholder="Ulangi password baru"
                      />
                      <button
                        type="button"
                        aria-label="Tahan untuk melihat password"
                        onMouseDown={() => setPwReveal((p) => ({ ...p, confirm: true }))}
                        onMouseUp={() => setPwReveal((p) => ({ ...p, confirm: false }))}
                        onMouseLeave={() => setPwReveal((p) => ({ ...p, confirm: false }))}
                        onTouchStart={() => setPwReveal((p) => ({ ...p, confirm: true }))}
                        onTouchEnd={() => setPwReveal((p) => ({ ...p, confirm: false }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600 select-none"
                      >
                        {pwReveal.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordStrengthMeter value={passwordForm.confirmPassword} />
                    {passwordForm.confirmPassword && passwordForm.confirmPassword !== passwordForm.newPassword ? (
                      <p className="text-[10px] font-semibold text-rose-600">Konfirmasi belum cocok dengan password baru.</p>
                    ) : null}
                    {passwordForm.confirmPassword && passwordForm.confirmPassword === passwordForm.newPassword ? (
                      <p className="text-[10px] font-semibold text-emerald-600">Konfirmasi cocok.</p>
                    ) : null}
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePasswordSave}
                    disabled={busyKey === 'password'}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busyKey === 'password' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Ganti Password
                  </button>
                  <button
                    type="button"
                    onClick={handleLogoutOthers}
                    disabled={busyKey === 'sessions' || sessionCount <= 1}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200/80 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-50"
                  >
                    Keluarkan Sesi Lain
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">Perangkat aktif</p>
                  <Badge tone="emerald">{sessionCount} sesi</Badge>
                </div>
                <div className="grid gap-3">
                  {sessions.map((session) => (
                    <div key={session.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <MonitorSmartphone className="h-5 w-5 text-slate-400" />
                          <div>
                            <p className="text-sm font-black text-slate-900">{session.deviceName}</p>
                            <p className="text-[11px] font-medium text-slate-500">{formatDateTime(session.lastUsedAt)}</p>
                          </div>
                        </div>
                        {session.isCurrent && (
                          <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Sesi ini</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        </Card>
      </div>

      {/* Profil sekolah utk kop rapor — hanya admin akademik */}
      {sysRole === 'admin_akademik' && <SchoolProfileSection pushToast={pushToast} />}

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="fixed bottom-8 right-8 z-[120] flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-slate-800 shadow-lg"
          >
            {toast.type === 'error' ? <AlertTriangle className="h-5 w-5 text-rose-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            <p className="text-sm font-medium">{toast.message}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
