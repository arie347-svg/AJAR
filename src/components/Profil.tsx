import React, { useState, useRef } from 'react';
import { Camera, FileSignature, Edit3, Key, X, Check, User as UserIcon } from 'lucide-react';
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
}

export const Profil: React.FC<ProfilProps> = ({
  token,
  currentUser,
  references,
  onUpdateUser,
  showToast,
  onNavigate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTabModal, setActiveTabModal] = useState<'profil' | 'password'>('profil');

  // Form fields for single edit modal
  const [editGelarDepan, setEditGelarDepan] = useState(currentUser?.gelarDepan || '');
  const [editNama, setEditNama] = useState(currentUser?.namaLengkap || '');
  const [editGelarBelakang, setEditGelarBelakang] = useState(currentUser?.gelarBelakang || '');
  const [editJabatan, setEditJabatan] = useState(currentUser?.jabatanId || currentUser?.jabatan || '');
  const [editAtasan, setEditAtasan] = useState(currentUser?.namaAtasan || 'Iyan Arif Hasyim, S.Pd, M.Pd');
  const [editUsername, setEditUsername] = useState(currentUser?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const parafInputRef = useRef<HTMLInputElement>(null);

  const handleOpenEdit = () => {
    setEditGelarDepan(currentUser?.gelarDepan || '');
    setEditNama(currentUser?.namaLengkap || '');
    setEditGelarBelakang(currentUser?.gelarBelakang || '');
    setEditJabatan(currentUser?.jabatanId || currentUser?.jabatan || '');
    setEditAtasan(currentUser?.namaAtasan || 'Iyan Arif Hasyim, S.Pd, M.Pd');
    setEditUsername(currentUser?.username || '');
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
        username: editUsername.trim(),
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
            username: editUsername,
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
    <div className="h-full w-full flex flex-col justify-between gap-3 text-slate-800 select-none overflow-hidden antialiased max-w-lg mx-auto">
      {/* 1. KARTU PROFIL UTAMA (Persis seperti Hero Welcome Card Dashboard / Beranda) */}
      <div className="rounded-[26px] p-4 sm:p-5 bg-gradient-to-br from-[#1A56DB] via-[#2167F3] to-[#1244A8] border border-white/30 shrink-0 relative overflow-hidden shadow-[-6px_-6px_16px_rgba(255,255,255,0.9),_8px_10px_24px_rgba(20,73,184,0.45),_inset_1.5px_1.5px_3px_rgba(255,255,255,0.35)] text-white">
        {/* Soft Decorative Ambient Neumorphic Rings */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full border-[10px] border-white/15 blur-[0.5px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-white/10 blur-xl"
        />

        <div className="relative z-10 flex items-center justify-between">
          {/* Foto Profil Bulat Diperbesar + Tombol Kamera */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full neu-pressed bg-white/20 p-1 shadow-inner flex items-center justify-center overflow-hidden border-2 border-white/60">
              {currentUser?.fotoUrl ? (
                <img
                  src={currentUser.fotoUrl}
                  alt="Foto Guru"
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-white text-[#1A56DB] flex items-center justify-center shadow-inner font-black text-sm">
                  <UserIcon className="w-7 h-7 stroke-[2.3]" />
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
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 flex items-center justify-center shadow-md cursor-pointer active:scale-95 transition-all border border-white"
              title="Ganti Foto Profil"
            >
              <Camera className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>

          <div className="min-w-0 px-3 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-100/90 block">
              Profil Guru
            </span>
            <h2 className="text-sm sm:text-base font-black text-white truncate tracking-tight mt-0.5">
              {currentUser?.namaTampilan || currentUser?.namaLengkap || 'Nama Guru'}
            </h2>
            <p className="text-[11px] text-blue-100/90 font-bold truncate mt-0.5">
              {currentUser?.jabatan || 'Guru Mata Pelajaran'}
            </p>
            <p className="text-[10px] text-blue-100/80 font-mono font-bold mt-0.5">
              NIP. {currentUser?.nip || '-'}
            </p>
          </div>

          {/* Single Edit Button */}
          <button
            type="button"
            onClick={handleOpenEdit}
            className="cursor-pointer active:scale-95 transition-all shrink-0 px-3 py-1.5 rounded-xl bg-white/20 border border-white/40 shadow-sm hover:bg-white/30 backdrop-blur-xs text-xs font-black text-white flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 stroke-[2.4]" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {/* 2. BAGIAN PARAF DIGITAL GURU (Menggantikan informasi akun & tugas) */}
      <div className="neu-flat rounded-2xl p-3 sm:p-4 bg-gradient-to-br from-[#EBF0F8] via-[#EBF3FC] to-[#DEECFA] border border-white/90 shadow-[-5px_-5px_12px_rgba(255,255,255,0.95),_6px_6px_14px_rgba(166,180,209,0.4)] shrink-0 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#d4deeb]/70">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shadow-xs">
              <FileSignature className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <h3 className="text-xs font-black text-[#0D162B] tracking-tight">
              Paraf Digital Guru
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-500">
            Tanda tangan sah dokumen
          </span>
        </div>

        <div className="h-20 sm:h-24 neu-pressed bg-[#E8EEF6] rounded-xl flex items-center justify-center p-2 my-1.5">
          {currentUser?.parafUrl ? (
            <img
              src={currentUser.parafUrl}
              alt="Paraf Guru"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-slate-400 text-xs font-bold italic">
              Belum Ada Paraf Digital
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
          className="w-full py-2 rounded-xl neu-flat active:neu-pressed text-blue-700 hover:text-blue-800 border border-blue-200 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
        >
          <FileSignature className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Upload / Ganti Paraf Digital</span>
        </button>
      </div>

      {/* 3. TOMBOL KEMBALI (Plain Text Saja, Tanpa Arrow, Tanpa Box) */}
      <div className="text-center py-1 shrink-0">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="text-xs font-extrabold text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer transition-colors"
        >
          kembali
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL MENGAMBANG (FLOATING EDIT MODAL) */}
      {/* ========================================================================= */}
      {isEditing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="neu-raised-card bg-[#EBF0F8] max-w-md w-full p-4 sm:p-5 rounded-[26px] relative border border-white/90 shadow-2xl animate-in zoom-in-95 duration-150 space-y-3 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d4deeb]/70 pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-[#0D162B]">
                  Edit Profil Guru
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  Perbarui data diri dan keamanan akun
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
                    ? 'neu-flat bg-[#EBF0F8] text-blue-700 shadow-xs'
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
                    ? 'neu-flat bg-[#EBF0F8] text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ubah Password
              </button>
            </div>

            <form onSubmit={handleSaveAll} className="space-y-3">
              {activeTabModal === 'profil' ? (
                <>
                  {/* NIP (Read-Only) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-slate-700 block">
                      NIP (Nomor Induk Pegawai) - <span className="text-slate-400 font-medium">Tidak dapat diubah</span>
                    </label>
                    <input
                      type="text"
                      disabled
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

                  <div>
                    <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                      Username Akun
                    </label>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={e => setEditUsername(e.target.value)}
                      className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl px-3.5 py-1.5 text-xs font-bold text-[#0D162B] outline-none font-mono"
                    />
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
                  className="w-full py-2 rounded-xl neu-flat active:neu-pressed text-slate-700 font-bold text-xs cursor-pointer"
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
