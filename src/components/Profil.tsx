import React, { useState, useRef } from 'react';
import { Camera, FileSignature, Edit3, X, User as UserIcon, AlertCircle } from 'lucide-react';
import { User, ReferencesMap, PageId } from '../types';
import { callGasApi } from '../services/gasApi';
import { toProperCase, formatProperCaseLive } from '../utils/textUtils';

interface ProfilProps {
  token: string;
  currentUser: User | null;
  references: ReferencesMap;
  onUpdateUser: (updated: User) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigate: (page: PageId) => void;
  onBack?: () => void;
}

export const Profil: React.FC<ProfilProps> = ({
  token,
  currentUser,
  references,
  onUpdateUser,
  showToast,
  onNavigate,
  onBack,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTabModal, setActiveTabModal] = useState<'profil' | 'password'>('profil');

  // Form fields for single edit modal (Kecuali NIP dan Foto, serta tanpa Username)
  const [editGelarDepan, setEditGelarDepan] = useState(currentUser?.gelarDepan || '');
  const [editNama, setEditNama] = useState(currentUser?.namaLengkap || '');
  const [editGelarBelakang, setEditGelarBelakang] = useState(currentUser?.gelarBelakang || '');
  const [editJabatan, setEditJabatan] = useState(currentUser?.jabatanId || currentUser?.jabatan || '');
  const [editAtasan, setEditAtasan] = useState(currentUser?.namaAtasan || 'Iyan Arif Hasyim, S.Pd, M.Pd');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const parafInputRef = useRef<HTMLInputElement>(null);

  const parafUrl = currentUser?.parafUrl || (currentUser as any)?.ParafGuruURL || '';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      onNavigate('dashboard');
    }
  };

  const handleOpenEdit = () => {
    setEditGelarDepan(currentUser?.gelarDepan || '');
    setEditNama(currentUser?.namaLengkap || '');
    setEditGelarBelakang(currentUser?.gelarBelakang || '');
    setEditJabatan(currentUser?.jabatanId || currentUser?.jabatan || '');
    setEditAtasan(currentUser?.namaAtasan || 'Iyan Arif Hasyim, S.Pd, M.Pd');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setActiveTabModal('profil');
    setIsEditing(true);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!editNama.trim()) {
        showToast('Nama lengkap wajib diisi!', 'warning');
        setSaving(false);
        return;
      }

      const cleanNama = toProperCase(editNama.trim());
      const payload: any = {
        type: 'ALL_PROFILE',
        gelarDepan: editGelarDepan,
        namaLengkap: cleanNama,
        gelarBelakang: editGelarBelakang,
        jabatan: editJabatan,
        namaAtasan: editAtasan.trim(),
        username: currentUser?.username || '',
      };

      if (newPassword.trim()) {
        if (!currentPassword || newPassword.length < 6 || newPassword !== confirmPassword) {
          showToast('Periksa kembali input password Anda (min 6 karakter & konfirmasi sesuai)!', 'warning');
          setSaving(false);
          return;
        }
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
        payload.confirmPassword = confirmPassword;
      }

      const res = await callGasApi('updateProfile', [token, payload]);
      if (res && res.success) {
        showToast(res.message || 'Profil berhasil diperbarui!', 'success');
        if (res.user) {
          onUpdateUser({ ...currentUser, ...res.user });
        } else if (currentUser) {
          const updated = {
            ...currentUser,
            gelarDepan: editGelarDepan,
            namaLengkap: cleanNama,
            gelarBelakang: editGelarBelakang,
            namaTampilan: `${editGelarDepan ? editGelarDepan + ' ' : ''}${cleanNama}${editGelarBelakang ? ', ' + editGelarBelakang : ''}`,
            jabatan: editJabatan,
            namaAtasan: editAtasan,
          };
          onUpdateUser(updated);
        }
        setIsEditing(false);
      } else {
        showToast(res?.message || 'Gagal memperbarui profil.', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadMedia = (type: 'FOTO' | 'PARAF', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast('Mengunggah berkas...', 'info');
    const reader = new FileReader();
    reader.onload = async evt => {
      const dataUrl = evt.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      try {
        const res = await callGasApi('uploadMediaFile', [
          token,
          base64,
          file.name,
          file.type,
          type,
        ]);
        if (res && res.success) {
          showToast(res.message || 'Berkas berhasil diunggah!', 'success');
          if (currentUser) {
            const updated = { ...currentUser };
            if (type === 'FOTO') updated.fotoUrl = res.fileUrl || dataUrl;
            if (type === 'PARAF') updated.parafUrl = res.parafDataUrl || dataUrl;
            onUpdateUser(updated);
          }
        } else {
          if (currentUser) {
            const updated = { ...currentUser };
            if (type === 'FOTO') updated.fotoUrl = dataUrl;
            if (type === 'PARAF') updated.parafUrl = dataUrl;
            onUpdateUser(updated);
          }
          showToast('Berkas berhasil disimpan secara lokal.', 'success');
        }
      } catch {
        showToast('Gagal mengunggah berkas.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="h-full w-full neu-bg bg-[#EEF2F6] flex flex-col justify-between gap-4 p-4 sm:p-6 rounded-[28px] text-slate-800 select-none overflow-y-auto no-scrollbar antialiased max-w-lg mx-auto">
      {/* KARTU PROFIL UTAMA NEUMORPHISM / SOFT UI MODERN */}
      <div className="w-full neu-raised-card bg-[#EEF2F6] rounded-[28px] p-6 sm:p-8 flex flex-col items-center text-center my-auto">
        
        {/* 1. BINGKAI FOTO DIPERBESAR (w-36 h-36) & DI TENGAH (mx-auto) + TOMBOL IKON EDIT FOTO */}
        <div className="relative w-36 h-36 mx-auto mb-5 shrink-0">
          <div className="w-full h-full rounded-full neu-inset bg-[#E8EEF6] p-2.5 flex items-center justify-center overflow-hidden">
            {currentUser?.fotoUrl ? (
              <img
                src={currentUser.fotoUrl}
                alt="Foto Guru"
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="w-full h-full rounded-full neu-flat bg-[#EEF2F6] text-[#1A56DB] flex items-center justify-center font-black">
                <UserIcon className="w-14 h-14 stroke-[2]" />
              </div>
            )}
          </div>

          <input
            type="file"
            ref={photoInputRef}
            accept="image/*"
            onChange={e => handleUploadMedia('FOTO', e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="absolute bottom-1 right-1 w-10 h-10 rounded-full neu-btn bg-[#EEF2F6] text-[#1A56DB] hover:text-blue-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
            title="Ganti Foto Profil"
          >
            <Camera className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* 2. NAMA LENGKAP */}
        <h2 className="text-base sm:text-lg font-black text-[#0D162B] tracking-tight leading-snug">
          {currentUser?.namaTampilan || currentUser?.namaLengkap || 'Nama Guru'}
        </h2>

        {/* 3. JABATAN */}
        <p className="text-xs sm:text-sm text-[#1A56DB] font-extrabold mt-1">
          {currentUser?.jabatan || 'Guru Mata Pelajaran'}
        </p>

        {/* 4. NIP */}
        <div className="mt-2.5 px-4 py-1.5 rounded-full neu-inset bg-[#E8EEF6] text-xs text-slate-600 font-mono font-bold">
          NIP. {currentUser?.nip || '-'}
        </div>

        {/* 5. KETERANGAN PARAF (Tampil "Belum ada paraf" jika Paraf kosong) */}
        <div className="mt-4 w-full flex flex-col items-center">
          {parafUrl ? (
            <div className="w-full max-w-[220px] py-2.5 px-4 rounded-2xl neu-inset bg-[#E8EEF6] flex flex-col items-center justify-center gap-1.5">
              <span className="text-[10px] font-extrabold text-emerald-600 flex items-center gap-1">
                <FileSignature className="w-3.5 h-3.5 stroke-[2.5]" />
                Paraf Digital Tersedia
              </span>
              <img
                src={parafUrl}
                alt="Paraf Guru"
                className="max-h-14 object-contain"
              />
            </div>
          ) : (
            <div className="px-4 py-2 rounded-xl neu-inset bg-[#E8EEF6] text-amber-600 text-xs font-extrabold flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              <span>Belum ada paraf</span>
            </div>
          )}
        </div>

        {/* 6. TOMBOL EDIT DI BAWAH KETERANGAN PARAF */}
        <button
          type="button"
          onClick={handleOpenEdit}
          className="mt-6 w-full max-w-[220px] py-2.5 px-5 rounded-2xl neu-btn bg-[#EEF2F6] text-xs font-black text-[#0D162B] hover:text-[#1A56DB] flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <Edit3 className="w-4 h-4 stroke-[2.4]" />
          <span>Edit</span>
        </button>
      </div>

      {/* 7. TOMBOL / TULISAN "KEMBALI" DI POSISI PALING BAWAH */}
      <div className="text-center py-1 shrink-0">
        <button
          type="button"
          onClick={handleBack}
          className="text-xs font-extrabold text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer transition-colors"
        >
          Kembali
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODAL MENGAMBANG (FLOATING EDIT MODAL - KECUALI NIP & FOTO, TANPA USERNAME) */}
      {/* ========================================================================= */}
      {isEditing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="neu-raised-card bg-[#EEF2F6] max-w-md w-full p-4 sm:p-5 rounded-[26px] relative border border-white/90 shadow-2xl animate-in zoom-in-95 duration-150 space-y-3 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d4deeb]/70 pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-[#0D162B]">
                  Edit Profil Guru
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  Perbarui data diri, paraf digital, dan keamanan akun
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-xl neu-flat active:neu-pressed text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Sub-Tabs Modal */}
            <div className="flex p-1 rounded-xl neu-pressed bg-[#E8EEF6] gap-1">
              <button
                type="button"
                onClick={() => setActiveTabModal('profil')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  activeTabModal === 'profil'
                    ? 'neu-flat bg-[#EEF2F6] text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Data Diri
              </button>
              <button
                type="button"
                onClick={() => setActiveTabModal('password')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  activeTabModal === 'password'
                    ? 'neu-flat bg-[#EEF2F6] text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ubah Password
              </button>
            </div>

            <form onSubmit={handleSaveAll} className="space-y-3">
              {activeTabModal === 'profil' ? (
                <>
                  {/* NIP (Terkunci / Read-Only) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-slate-700 block">
                      NIP (Nomor Induk Pegawai) - <span className="text-slate-400 font-medium">Tidak dapat diubah</span>
                    </label>
                    <input
                      type="text"
                      disabled
                      readOnly
                      value={currentUser?.nip || ''}
                      className="w-full neu-pressed bg-[#E8EEF6] border border-white/50 rounded-xl px-3 py-1.5 text-xs font-black text-slate-400 cursor-not-allowed select-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                        Gelar Depan
                      </label>
                      <select
                        value={editGelarDepan}
                        onChange={e => setEditGelarDepan(e.target.value)}
                        className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl px-2 py-1.5 text-xs font-bold text-[#0D162B] outline-none"
                      >
                        {references.GelarDepan.map((g, i) => (
                          <option key={i} value={g.code || ''}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        value={editNama}
                        onChange={e => setEditNama(formatProperCaseLive(e.target.value))}
                        onBlur={() => setEditNama(prev => toProperCase(prev.trim()))}
                        className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl px-3 py-1.5 text-xs font-bold text-[#0D162B] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                      Gelar Belakang
                    </label>
                    <select
                      value={editGelarBelakang}
                      onChange={e => setEditGelarBelakang(e.target.value)}
                      className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl px-3 py-1.5 text-xs font-bold text-[#0D162B] outline-none"
                    >
                      {references.GelarBelakang.map((g, i) => (
                        <option key={i} value={g.code || ''}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                      Jabatan Guru
                    </label>
                    <select
                      value={editJabatan}
                      onChange={e => setEditJabatan(e.target.value)}
                      className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl px-3 py-1.5 text-xs font-bold text-[#0D162B] outline-none"
                    >
                      {references.Jabatan.map((j, i) => (
                        <option key={i} value={j.id || j.code || j.name}>
                          {toProperCase(j.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                      Nama Atasan Langsung
                    </label>
                    <input
                      type="text"
                      value={editAtasan}
                      onChange={e => setEditAtasan(e.target.value)}
                      className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl px-3.5 py-1.5 text-xs font-bold text-[#0D162B] outline-none"
                    />
                  </div>

                  {/* Upload / Ganti Paraf Digital di dalam Form Edit */}
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                      Paraf Digital Guru
                    </label>
                    <div className="h-20 neu-pressed bg-[#E8EEF6] rounded-xl flex items-center justify-center p-2 mb-2">
                      {parafUrl ? (
                        <img
                          src={parafUrl}
                          alt="Paraf Guru"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-slate-400 text-xs font-bold italic">
                          Belum ada paraf
                        </span>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={parafInputRef}
                      accept="image/*"
                      onChange={e => handleUploadMedia('PARAF', e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => parafInputRef.current?.click()}
                      className="w-full py-2 rounded-xl neu-btn bg-[#EEF2F6] text-blue-700 hover:text-blue-800 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <FileSignature className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Upload / Ganti Paraf Digital</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                      Password Saat Ini
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan password lama"
                      className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl px-3.5 py-1.5 text-xs font-bold text-[#0D162B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                      Password Baru (min 6 karakter)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Masukkan password baru"
                      className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl px-3.5 py-1.5 text-xs font-bold text-[#0D162B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                      Konfirmasi Password Baru
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password baru"
                      className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl px-3.5 py-1.5 text-xs font-bold text-[#0D162B] outline-none"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-[#d4deeb]/70">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="w-full py-2 rounded-xl neu-btn bg-[#EEF2F6] text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};