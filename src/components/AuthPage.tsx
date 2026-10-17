import React, { useState, useEffect, useMemo } from 'react';
import {
  User as UserIcon,
  Lock,
  CreditCard,
  Eye,
  EyeOff,
  ArrowRight,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { ReferencesMap, User } from '../types';
import {
  callGasApi,
  DEFAULT_REFERENCES,
  warmUpGasConnection,
  GasConnectionInfo,
  normalizeIdentifierInput,
} from '../services/gasApi';
import { NeuDropdown, NeuDropdownOption } from './NeuDropdown';
import { toProperCase, formatProperCaseLive } from '../utils/textUtils';
import { AjarBrandLogo } from './AjarBrandLogo';

interface AuthPageProps {
  references: ReferencesMap;
  onLoginSuccess: (user: User, token: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  gasConnection?: GasConnectionInfo | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({ references, onLoginSuccess, showToast }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  // Pre-warming koneksi backend Google Apps Script secara spekulatif saat halaman dibuka
  useEffect(() => {
    warmUpGasConnection();
  }, []);

  // Login form state
  const [loginUsername, setLoginUsername] = useState(
    localStorage.getItem('remembered_username') || ''
  );
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register form state
  const [regGelarDepan, setRegGelarDepan] = useState('');
  const [regNama, setRegNama] = useState('');
  const [regGelarBelakang, setRegGelarBelakang] = useState('');
  const [regNip, setRegNip] = useState('');
  const [regJabatan, setRegJabatan] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [isPasswordManuallyEdited, setIsPasswordManuallyEdited] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(true);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reference lists with fallbacks
  const listGelarDepan = useMemo(() => {
    const raw =
      references.GelarDepan && references.GelarDepan.length > 0
        ? references.GelarDepan
        : DEFAULT_REFERENCES.GelarDepan;
    const hasEmpty = raw.some(g => !g.code);
    return hasEmpty ? raw : [{ code: '', name: '-- Tanpa Gelar Depan --' }, ...raw];
  }, [references.GelarDepan]);

  const listGelarBelakang = useMemo(() => {
    const raw =
      references.GelarBelakang && references.GelarBelakang.length > 0
        ? references.GelarBelakang
        : DEFAULT_REFERENCES.GelarBelakang;
    const hasEmpty = raw.some(g => !g.code);
    return hasEmpty ? raw : [{ code: '', name: '-- Tanpa Gelar Belakang --' }, ...raw];
  }, [references.GelarBelakang]);

  const listJabatan = useMemo(() => {
    const raw =
      references.Jabatan && references.Jabatan.length > 0
        ? references.Jabatan
        : DEFAULT_REFERENCES.Jabatan;
    const hasGuruMapel = raw.some(
      j =>
        j.name.toLowerCase() === 'guru mata pelajaran' ||
        j.id === 'Guru Mata Pelajaran'
    );
    return hasGuruMapel
      ? raw
      : [
          { id: 'Guru Mata Pelajaran', code: 'Guru Mata Pelajaran', name: 'Guru Mata Pelajaran' },
          ...raw,
        ];
  }, [references.Jabatan]);

  const optionsGelarDepan: NeuDropdownOption[] = useMemo(
    () =>
      listGelarDepan.map(g => ({
        value: g.code ?? '',
        label: g.name,
      })),
    [listGelarDepan]
  );

  const optionsGelarBelakang: NeuDropdownOption[] = useMemo(
    () =>
      listGelarBelakang.map(g => ({
        value: g.code ?? '',
        label: g.name,
      })),
    [listGelarBelakang]
  );

  const optionsJabatan: NeuDropdownOption[] = useMemo(
    () =>
      listJabatan.map(j => ({
        value: j.id || j.code || j.name,
        label: toProperCase(j.name),
      })),
    [listJabatan]
  );

  // Pastikan nilai default regJabatan tidak terpilih otomatis agar menampilkan petunjuk "Pilih Jabatan"
  const passHasMinLength = regPassword.length >= 6;
  const passHasLetter = /[a-zA-Z]/.test(regPassword);
  const passHasNumber = /[0-9]/.test(regPassword);
  const isManualPasswordValid = passHasMinLength && passHasLetter && passHasNumber;

  const handleNipInput = (val: string) => {
    // Bersihkan spasi/tanda baca tanpa memotong string mentah sebelum dibersihkan
    const cleanDigits = val.replace(/[^0-9]/g, '').slice(0, 18);
    setRegNip(cleanDigits);

    // Sinkronisasi otomatis password dengan NIP selama belum pernah diubah manual oleh pengguna
    if (!isPasswordManuallyEdited) {
      setRegPassword(cleanDigits);
    }

    if (errors['regNip']) {
      setErrors(prev => {
        const next = { ...prev };
        delete next['regNip'];
        return next;
      });
    }
  };

  const isNip18 = regNip.length === 18;
  const isNipValidLength = regNip.length >= 6;
  const cleanLoginDigits = loginUsername.replace(/[^0-9]/g, '');
  const isLoginNip18 = cleanLoginDigits.length === 18;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedUser = normalizeIdentifierInput(loginUsername);
    const trimmedPass = loginPassword.trim();

    const newErrors: Record<string, string> = {};
    if (!normalizedUser) newErrors.loginUsername = 'NIP atau Nama Pengguna wajib diisi!';
    if (!trimmedPass) newErrors.loginPassword = 'Kata sandi wajib diisi!';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast(newErrors.loginUsername || newErrors.loginPassword, 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await callGasApi('loginUser', [normalizedUser, trimmedPass]);
      if (res && res.success && res.user) {
        if (rememberMe) {
          localStorage.setItem('remembered_username', normalizedUser);
          localStorage.setItem('ajar_remember_login', 'true');
        }
        onLoginSuccess(res.user, res.token || 'session-' + Date.now());
      } else {
        const msg = res?.message || 'NIP/Username atau kata sandi belum sesuai!';
        showToast(msg, 'error');
        setErrors({ loginPassword: msg });
      }
    } catch {
      showToast('Gagal menghubungi server. Silakan coba kembali.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNama = toProperCase(regNama.trim());
    setRegNama(cleanNama);

    const cleanNip = regNip.replace(/[^0-9]/g, '').trim();
    const finalPassword = (regPassword || cleanNip).trim();

    const newErrors: Record<string, string> = {};
    if (!cleanNama) newErrors.regNama = 'Nama lengkap wajib diisi!';
    if (!regJabatan) newErrors.regJabatan = 'Silakan pilih jabatan terlebih dahulu!';
    if (!cleanNip || cleanNip.length < 6) {
      newErrors.regNip = 'Masukkan 18 digit NIP (atau minimal 6 digit ID Pegawai/NUPTK)!';
    }
    if (isPasswordManuallyEdited) {
      if (
        finalPassword.length < 6 ||
        !/[a-zA-Z]/.test(finalPassword) ||
        !/[0-9]/.test(finalPassword)
      ) {
        newErrors.regPassword =
          'Password manual wajib minimal 6 karakter serta mengandung huruf dan angka!';
      }
    } else if (!finalPassword || finalPassword.length < 6) {
      newErrors.regPassword = 'Password minimal 6 karakter!';
    }
    if (!termsAgreed) {
      newErrors.terms = 'Anda harus menyetujui pernyataan kebenaran data!';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast(
        newErrors.regNama ||
          newErrors.regJabatan ||
          newErrors.regNip ||
          newErrors.regPassword ||
          newErrors.terms,
        'warning'
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        gelarDepan: regGelarDepan.trim(),
        namaLengkap: cleanNama,
        gelarBelakang: regGelarBelakang.trim(),
        nip: cleanNip,
        jabatanId: regJabatan || 'Guru Mata Pelajaran',
        password: finalPassword,
        confirmPassword: finalPassword,
      };

      const res = await callGasApi('registerGuru', [payload]);
      if (res && res.success) {
        showToast(
          res.message || 'Pendaftaran berhasil! Silakan masuk menggunakan akun Anda.',
          'success'
        );
        setLoginUsername(cleanNip);
        setLoginPassword(finalPassword);
        localStorage.setItem('remembered_username', cleanNip);
        setErrors({});
        setIsRegister(false);
      } else {
        showToast(res?.message || 'Gagal melakukan pendaftaran akun.', 'error');
      }
    } catch {
      showToast('Terjadi kendala saat menyimpan pendaftaran.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 h-full h-[100dvh] w-full overflow-hidden bg-[#EEF0F4] flex items-center justify-center p-0 sm:p-6 lg:p-8 text-[#1E2430] antialiased selection:bg-blue-200">
      {/* Main Container: Fullscreen on mobile, centered elevated tactile card on desktop */}
      <main className="relative z-10 w-full h-full h-[100dvh] sm:h-auto sm:max-h-[94vh] sm:max-w-[450px] md:max-w-[470px] bg-[#EEF0F4] overflow-y-auto no-scrollbar overscroll-none flex flex-col justify-between px-6 py-6 sm:px-9 sm:py-7 neu-raised-card sm:rounded-[38px] transition-all">
        {/* Content Section */}
        <div className="relative z-10 w-full flex flex-col items-center my-auto">
          {/* 3D Neumorphic Logo Squircle Pedestal */}
          <section className="flex flex-col items-center mb-4 shrink-0">
            <div className="neu-logo-tile w-22 h-22 sm:w-24 sm:h-24 rounded-[28px] sm:rounded-[32px] flex items-center justify-center p-2.5 relative transition-transform duration-300">
              <AjarBrandLogo idPrefix="auth" className="w-13 h-13 sm:w-15 sm:h-15" />
            </div>
          </section>

          {/* Header Title & Subtitle */}
          <section className="text-center mb-5 shrink-0 flex flex-col items-center">
            <h1 className="text-[24px] sm:text-[27px] font-extrabold tracking-tight text-[#1E2430]">
              {isRegister ? 'Daftar Akun' : 'Ajar 2.0'}
            </h1>
            {!isRegister && (
              <p className="text-[#5A6578] font-medium text-[12px] sm:text-[13px] tracking-wide mt-0.5 max-w-xs">
                Sistem Jurnal Pembelajaran, Presensi &amp; Nilai
              </p>
            )}
          </section>

          {/* ==================== TAMPILAN MASUK (LOGIN) ==================== */}
          {!isRegister ? (
            <form onSubmit={handleLoginSubmit} className="w-full space-y-4" autoComplete="off">
              {/* Input Username / NIP */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[#5A6578] px-1 tracking-wide">
                  Username
                </label>
                <div className="neu-input-pill h-[52px] sm:h-[54px] rounded-2xl flex items-center px-4 space-x-3.5 relative">
                  <UserIcon className="w-5 h-5 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    name="ajar_nip_identifier"
                    autoComplete="off"
                    value={loginUsername}
                    onFocus={() => warmUpGasConnection()}
                    onChange={e => {
                      setLoginUsername(e.target.value);
                      if (errors.loginUsername) setErrors(prev => ({ ...prev, loginUsername: '' }));
                    }}
                    placeholder="Masukkan NIP"
                    disabled={loading}
                    className="w-full bg-transparent border-none p-0 text-[#1E2430] placeholder-slate-400 text-[14px] font-semibold font-mono tabular-nums focus:ring-0 focus:outline-none"
                  />
                  {isLoginNip18 && (
                    <span className="nip-valid-pop flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 px-1.5 py-0.5 shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>18 Digit</span>
                    </span>
                  )}
                </div>
              </div>
              {errors.loginUsername && (
                <p className="text-[11px] text-rose-600 font-bold px-2 -mt-2">
                  {errors.loginUsername}
                </p>
              )}

              {/* Input Password */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[#5A6578] px-1 tracking-wide">
                  Password
                </label>
                <div className="neu-input-pill h-[52px] sm:h-[54px] rounded-2xl flex items-center px-4 space-x-3.5 relative">
                  <Lock className="w-5 h-5 text-slate-500 shrink-0" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    name="ajar_access_code"
                    autoComplete="off"
                    value={loginPassword}
                    onFocus={() => warmUpGasConnection()}
                    onChange={e => {
                      setLoginPassword(e.target.value);
                      if (errors.loginPassword) setErrors(prev => ({ ...prev, loginPassword: '' }));
                    }}
                    placeholder="Masukkan kata sandi"
                    disabled={loading}
                    className="w-full bg-transparent border-none p-0 text-[#1E2430] placeholder-slate-400 text-[14px] font-medium focus:ring-0 focus:outline-none tracking-normal pr-7"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label="Tampilkan atau sembunyikan kata sandi"
                    disabled={loading}
                    className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {showLoginPassword ? (
                      <Eye className="w-5 h-5" />
                    ) : (
                      <EyeOff className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              {errors.loginPassword && (
                <p className="text-[11px] text-rose-600 font-bold px-2 -mt-2">
                  {errors.loginPassword}
                </p>
              )}

              {/* Opsi Ingatkan Saya */}
              <div className="flex items-center justify-between pt-0.5 px-1 text-[13px]">
                <label className="inline-flex items-center space-x-2.5 cursor-pointer select-none min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    disabled={loading}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-[18px] h-[18px] rounded-md border-0 text-[#2563EB] bg-[#2563EB] focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer disabled:opacity-60"
                  />
                  <span className="text-[#5A6578] font-semibold text-[12.5px]">
                    Ingatkan Saya
                  </span>
                </label>
              </div>

              {/* Tombol Utama Masuk */}
              <div className="pt-1.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="neu-btn-primary w-full h-[52px] sm:h-[54px] rounded-2xl flex items-center justify-between px-5 text-white cursor-pointer group disabled:opacity-75 transition-all"
                >
                  <div className="w-8 flex items-center justify-center">
                    {loading && (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                  </div>
                  <span className="text-[15px] sm:text-[16px] font-bold tracking-wide">
                    {loading ? 'Memverifikasi Akun...' : 'Masuk'}
                  </span>
                  <div className="arrow-badge w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </div>
                </button>
              </div>
            </form>
          ) : (
            /* ==================== TAMPILAN PENDAFTARAN (SIGN UP) ==================== */
            <form onSubmit={handleRegisterSubmit} className="w-full space-y-3" autoComplete="off">
              {/* 1. Nama Lengkap & Gelar */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#5A6578] px-1">
                  Nama Lengkap
                </label>
                <div className="grid grid-cols-12 gap-2">
                  {/* Gelar Depan Dropdown */}
                  <div className="col-span-5">
                    <NeuDropdown
                      value={regGelarDepan}
                      onChange={setRegGelarDepan}
                      options={optionsGelarDepan}
                      placeholder="Gelar Dpn"
                    />
                  </div>

                  {/* Gelar Belakang Dropdown */}
                  <div className="col-span-7">
                    <NeuDropdown
                      value={regGelarBelakang}
                      onChange={setRegGelarBelakang}
                      options={optionsGelarBelakang}
                      placeholder="Gelar Blkg"
                    />
                  </div>

                  {/* Nama Lengkap Inti */}
                  <div className="col-span-12 neu-input-container rounded-2xl flex items-center px-3.5 py-2.5 sm:py-3 gap-2.5">
                    <UserIcon className="w-5 h-5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      required
                      value={regNama}
                      onChange={e => {
                        const formatted = formatProperCaseLive(e.target.value);
                        setRegNama(formatted);
                        if (errors.regNama) setErrors(prev => ({ ...prev, regNama: '' }));
                      }}
                      onBlur={() => {
                        setRegNama(prev => toProperCase(prev.trim()));
                      }}
                      placeholder="Contoh: Ahmad Fauzi"
                      className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm font-semibold text-[#1E2430] placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                    />
                  </div>
                </div>
                {errors.regNama && (
                  <p className="text-[10px] text-rose-600 font-bold px-1">{errors.regNama}</p>
                )}
              </div>

              {/* 2. Jabatan Neumorphic Dropdown (Tulisan Saja "Pilih Jabatan" Sebelum Dipilih) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#5A6578] px-1">
                  Jabatan
                </label>
                <NeuDropdown
                  value={regJabatan}
                  onChange={val => {
                    setRegJabatan(val);
                    if (errors.regJabatan) setErrors(prev => ({ ...prev, regJabatan: '' }));
                  }}
                  options={optionsJabatan}
                  placeholder="Pilih Jabatan"
                />
                {errors.regJabatan && (
                  <p className="text-[10px] text-rose-600 font-bold px-1">{errors.regJabatan}</p>
                )}
              </div>

              {/* 3. NIP Field (Mendukung Copy-Paste dengan Spasi & Non-PNS) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="block text-xs font-semibold text-[#5A6578]">
                    NIP
                  </label>
                  <div className="flex items-center">
                    {isNip18 ? (
                      <span className="nip-valid-pop flex items-center gap-1 text-[11px] font-extrabold text-emerald-700">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>18 Digit Lengkap</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold font-mono tabular-nums text-[#5A6578] transition-colors">
                        {regNip.length}/18 digit
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`neu-input-container rounded-2xl flex items-center px-3.5 py-2.5 sm:py-3 gap-2.5 transition-all ${
                    isNip18
                      ? 'ring-2 ring-emerald-500/40 border-emerald-400/80'
                      : isNipValidLength
                      ? 'ring-1 ring-blue-400/30'
                      : ''
                  }`}
                >
                  <CreditCard
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isNip18 ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={32}
                    required
                    value={regNip}
                    onChange={e => handleNipInput(e.target.value)}
                    placeholder="Ketik atau tempel 18 digit NIP"
                    className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm font-semibold font-mono tabular-nums text-[#1E2430] placeholder:text-slate-400 placeholder:font-sans focus:ring-0 focus:outline-none tracking-wide"
                  />
                  {isNip18 && (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 nip-valid-pop">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                {errors.regNip && (
                  <p className="text-[10px] text-rose-600 font-bold px-1">{errors.regNip}</p>
                )}
              </div>

              {/* 4. Password (Otomatis Mengikuti NIP atau Ketik Manual dengan Validasi Langsung) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="block text-xs font-semibold text-[#5A6578]">
                    Password
                  </label>
                  {!isPasswordManuallyEdited ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-blue-600 font-bold">
                        Otomatis sama dengan NIP
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPasswordManuallyEdited(true);
                          setRegPassword('');
                          setShowRegPassword(true);
                        }}
                        className="text-[10px] text-slate-500 hover:text-blue-600 font-semibold underline cursor-pointer"
                      >
                        Ketik Manual
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsPasswordManuallyEdited(false);
                        setRegPassword(regNip);
                        if (errors.regPassword) setErrors(prev => ({ ...prev, regPassword: '' }));
                      }}
                      className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      Samakan dengan NIP
                    </button>
                  )}
                </div>
                <div
                  className={`neu-input-container rounded-2xl flex items-center px-3.5 py-2.5 sm:py-3 gap-2.5 relative transition-all ${
                    isPasswordManuallyEdited && regPassword.length > 0
                      ? isManualPasswordValid
                        ? 'ring-2 ring-emerald-500/40 border-emerald-400/80'
                        : 'ring-1 ring-amber-500/40'
                      : ''
                  }`}
                >
                  <Lock
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isPasswordManuallyEdited && isManualPasswordValid
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                    }`}
                  />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={e => {
                      setIsPasswordManuallyEdited(true);
                      setRegPassword(e.target.value);
                      if (errors.regPassword) setErrors(prev => ({ ...prev, regPassword: '' }));
                    }}
                    placeholder={
                      isPasswordManuallyEdited
                        ? 'Min. 6 karakter, kombinasi huruf & angka'
                        : 'Minimal 6 karakter'
                    }
                    className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm font-medium text-[#1E2430] placeholder:text-slate-400 focus:ring-0 focus:outline-none pr-7"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    aria-label="Tampilkan atau sembunyikan kata sandi"
                    className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer"
                  >
                    {showRegPassword ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Indikator Validasi Langsung saat Ketik Manual */}
                {isPasswordManuallyEdited && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 px-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                        passHasMinLength
                          ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                          : 'bg-slate-200/70 text-slate-500 border border-slate-300/50'
                      }`}
                    >
                      <Check
                        className={`w-3 h-3 ${
                          passHasMinLength ? 'text-emerald-600 stroke-[3]' : 'opacity-40'
                        }`}
                      />
                      6+ Karakter
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                        passHasLetter
                          ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                          : 'bg-slate-200/70 text-slate-500 border border-slate-300/50'
                      }`}
                    >
                      <Check
                        className={`w-3 h-3 ${
                          passHasLetter ? 'text-emerald-600 stroke-[3]' : 'opacity-40'
                        }`}
                      />
                      Ada Huruf
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                        passHasNumber
                          ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                          : 'bg-slate-200/70 text-slate-500 border border-slate-300/50'
                      }`}
                    >
                      <Check
                        className={`w-3 h-3 ${
                          passHasNumber ? 'text-emerald-600 stroke-[3]' : 'opacity-40'
                        }`}
                      />
                      Ada Angka
                    </span>
                  </div>
                )}

                {errors.regPassword && (
                  <p className="text-[10px] text-rose-600 font-bold px-1">{errors.regPassword}</p>
                )}
              </div>

              {/* Persetujuan Kebenaran Data */}
              <div className="flex items-start pt-0.5">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#5A6578] select-none min-h-[34px]">
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    disabled={loading}
                    onChange={e => setTermsAgreed(e.target.checked)}
                    className="w-4 h-4 rounded neu-checkbox text-blue-600 focus:ring-blue-400 focus:ring-offset-0 cursor-pointer disabled:opacity-60"
                  />
                  <span>Data yang saya isi sudah benar</span>
                </label>
              </div>

              {/* Tombol Utama Daftar Sekarang */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="neu-btn-primary w-full h-[52px] sm:h-[54px] rounded-2xl flex items-center justify-between px-5 text-white cursor-pointer group disabled:opacity-75 transition-all"
                >
                  <div className="w-8 flex items-center justify-center">
                    {loading && (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                  </div>
                  <span className="text-[15px] sm:text-[16px] font-bold tracking-wide">
                    {loading ? 'Mendaftarkan Akun...' : 'Daftar Sekarang'}
                  </span>
                  <div className="arrow-badge w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </div>
                </button>
              </div>
            </form>
          )}

          {/* Navigasi Beralih Masuk / Daftar */}
          <footer className="w-full mt-4 pt-1 text-center shrink-0">
            {!isRegister ? (
              <p className="text-center text-xs text-[#5A6578] font-medium">
                Belum memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setErrors({});
                  }}
                  className="text-[#2563EB] font-bold hover:underline ml-0.5 cursor-pointer inline-block"
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p className="text-center text-xs text-[#5A6578] font-medium">
                Sudah memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setErrors({});
                  }}
                  className="text-[#2563EB] font-bold hover:underline transition-colors ml-0.5 cursor-pointer inline-block"
                >
                  Log In
                </button>
              </p>
            )}
          </footer>
        </div>

        {/* Footer Identitas Aplikasi */}
        <footer className="w-full text-center pt-3 pb-1 relative z-10 shrink-0 border-t border-slate-300/40 mt-3">
          <div className="inline-flex items-center justify-center gap-1.5 text-[10.5px] text-[#5A6578] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Ajar 2.0 MAN 1 Majalengka</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

