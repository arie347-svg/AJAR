import React, { useState, useRef } from 'react';
import { Camera, FileSignature, Edit2, Key, X, Check, User as UserIcon } from 'lucide-react';
import { User, ReferencesMap } from '../types';
import { callGasApi } from '../services/gasApi';
import { toProperCase, formatProperCaseLive } from '../utils/textUtils';

interface ProfilProps {
  token: string;
  currentUser: User | null;
  references: ReferencesMap;
  onUpdateUser: (updated: User) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const Profil: React.FC<ProfilProps> = ({
  token,
  currentUser,
  references,
  onUpdateUser,
  showToast,
}) => {
  const [modalType, setModalType] = useState<
    'NAMA_GELAR' | 'JABATAN' | 'ATASAN' | 'USERNAME' | 'PASSWORD' | null
  >(null);

  // Form fields for edit modal
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

  const handleOpenModal = (
    type: 'NAMA_GELAR' | 'JABATAN' | 'ATASAN' | 'USERNAME' | 'PASSWORD'
  ) => {
    setModalType(type);
    setEditGelarDepan(currentUser?.gelarDepan || '');
    setEditNama(currentUser?.namaLengkap || '');
    setEditGelarBelakang(currentUser?.gelarBelakang || '');
    setEditJabatan(currentUser?.jabatanId || currentUser?.jabatan || '');
    setEditAtasan(currentUser?.namaAtasan || 'Iyan Arif Hasyim, S.Pd, M.Pd');
    setEditUsername(currentUser?.username || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { type: modalType };

      if (modalType === 'NAMA_GELAR') {
        if (!editNama.trim()) {
          showToast('Nama lengkap wajib diisi!', 'warning');
          setSaving(false);
          return;
        }
        const cleanNama = toProperCase(editNama.trim());
        payload.gelarDepan = editGelarDepan;
        payload.namaLengkap = cleanNama;
        payload.gelarBelakang = editGelarBelakang;
      } else if (modalType === 'JABATAN') {
        payload.jabatan = editJabatan;
      } else if (modalType === 'ATASAN') {
        payload.namaAtasan = editAtasan.trim();
      } else if (modalType === 'USERNAME') {
        payload.username = editUsername.trim();
      } else if (modalType === 'PASSWORD') {
        if (!currentPassword || newPassword.length < 6 || newPassword !== confirmPassword) {
          showToast('Periksa kembali input password Anda!', 'warning');
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
          const updated = { ...currentUser };
          if (modalType === 'NAMA_GELAR') {
            const cleanNama = toProperCase(editNama.trim());
            updated.gelarDepan = editGelarDepan;
            updated.namaLengkap = cleanNama;
            updated.gelarBelakang = editGelarBelakang;
            updated.namaTampilan = `${editGelarDepan ? editGelarDepan + ' ' : ''}${cleanNama}${editGelarBelakang ? ', ' + editGelarBelakang : ''}`;
          } else if (modalType === 'JABATAN') {
            updated.jabatan = editJabatan;
          } else if (modalType === 'ATASAN') {
            updated.namaAtasan = editAtasan;
          } else if (modalType === 'USERNAME') {
            updated.username = editUsername;
          }
          onUpdateUser(updated);
        }
        setModalType(null);
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
          // Local fallback
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
    <div className="space-y-4 pb-24">
      <div className="bg-white/15 backdrop-blur-md rounded-3xl p-5 shadow-xl shadow-black/10 space-y-4 text-white border border-white/15">
        {/* Foto & Paraf Section */}
        <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm p-4 rounded-3xl border border-white/10">
          <div className="text-center">
            {currentUser?.fotoUrl ? (
              <img
                src={currentUser.fotoUrl}
                alt="Foto Guru"
                className="w-16 h-20 object-cover rounded-2xl mx-auto shadow-md ring-2 ring-white/30"
              />
            ) : (
              <div className="w-16 h-20 bg-white/20 rounded-2xl mx-auto shadow-md ring-2 ring-white/30 flex items-center justify-center text-white/50">
                <UserIcon className="w-8 h-8" />
              </div>
            )}
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
              className="mt-2 px-3 py-1 bg-[#facc15] hover:bg-[#eab308] text-slate-900 rounded-full text-[10px] font-extrabold shadow-sm active:scale-95 cursor-pointer flex items-center gap-1 mx-auto"
            >
              <Camera className="w-3 h-3" />
              <span>Ganti Foto</span>
            </button>
          </div>

          <div className="flex-1 text-center">
            <p className="text-[10px] font-bold text-[#fde047] uppercase tracking-wider mb-1.5">
              Paraf Digital Guru
            </p>
            <div className="h-16 bg-white/90 rounded-2xl flex items-center justify-center p-2 shadow-xs">
              {currentUser?.parafUrl ? (
                <img
                  src={currentUser.parafUrl}
                  alt="Paraf Guru"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-slate-400 text-[10px] font-bold font-mono">
                  Belum Ada Paraf
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
              className="mt-2 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-full text-[10px] font-bold shadow-sm active:scale-95 cursor-pointer flex items-center gap-1 mx-auto"
            >
              <FileSignature className="w-3 h-3" />
              <span>Upload Paraf</span>
            </button>
          </div>
        </div>

        {/* Profile Attributes List */}
        <div className="space-y-2 text-xs font-semibold">
          <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center border border-white/5">
            <span className="text-white/60">Nama Lengkap &amp; Gelar</span>
            <div className="flex items-center space-x-2">
              <span className="text-white font-bold">
                {currentUser?.namaTampilan || currentUser?.namaLengkap || '-'}
              </span>
              <button
                type="button"
                onClick={() => handleOpenModal('NAMA_GELAR')}
                className="text-xs font-extrabold text-[#facc15] px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-full active:scale-95 cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center border border-white/5">
            <span className="text-white/60">NIP</span>
            <span className="text-white font-mono font-bold">{currentUser?.nip || '-'}</span>
          </div>

          <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center border border-white/5">
            <span className="text-white/60">Jabatan Guru</span>
            <div className="flex items-center space-x-2">
              <span className="text-white font-bold">{currentUser?.jabatan || '-'}</span>
              <button
                type="button"
                onClick={() => handleOpenModal('JABATAN')}
                className="text-xs font-extrabold text-[#facc15] px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-full active:scale-95 cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center border border-white/5">
            <span className="text-white/60">Atasan Langsung (Direct)</span>
            <div className="flex items-center space-x-2">
              <span className="text-white font-bold">
                {currentUser?.namaAtasan || 'Iyan Arif Hasyim, S.Pd, M.Pd'}
              </span>
              <button
                type="button"
                onClick={() => handleOpenModal('ATASAN')}
                className="text-xs font-extrabold text-[#facc15] px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-full active:scale-95 cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center border border-white/5">
            <span className="text-white/60">Username Sistem</span>
            <div className="flex items-center space-x-2">
              <span className="text-white font-mono font-bold">
                {currentUser?.username || '-'}
              </span>
              <button
                type="button"
                onClick={() => handleOpenModal('USERNAME')}
                className="text-xs font-extrabold text-[#facc15] px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-full active:scale-95 cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="p-3 bg-white/10 rounded-2xl flex justify-between items-center border border-white/5">
            <span className="text-white/60">Keamanan Akun</span>
            <button
              type="button"
              onClick={() => handleOpenModal('PASSWORD')}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full text-[10px] font-bold active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Key className="w-3 h-3" />
              <span>Ubah Password</span>
            </button>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#002830] border border-white/20 rounded-3xl p-5 max-w-sm w-full text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-[#fde047]">
                {modalType === 'NAMA_GELAR' && 'Edit Nama & Gelar'}
                {modalType === 'JABATAN' && 'Edit Jabatan Guru'}
                {modalType === 'ATASAN' && 'Edit Atasan Langsung'}
                {modalType === 'USERNAME' && 'Edit Username Akun'}
                {modalType === 'PASSWORD' && 'Ubah Password Akun'}
              </h3>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3">
              {modalType === 'NAMA_GELAR' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                      Gelar Depan
                    </label>
                    <select
                      value={editGelarDepan}
                      onChange={e => setEditGelarDepan(e.target.value)}
                      className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                    >
                      {references.GelarDepan.map((g, i) => (
                        <option key={i} value={g.code || ''} className="bg-slate-900">
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      value={editNama}
                      onChange={e => setEditNama(formatProperCaseLive(e.target.value))}
                      onBlur={() => setEditNama(prev => toProperCase(prev.trim()))}
                      className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                      Gelar Belakang
                    </label>
                    <select
                      value={editGelarBelakang}
                      onChange={e => setEditGelarBelakang(e.target.value)}
                      className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                    >
                      {references.GelarBelakang.map((g, i) => (
                        <option key={i} value={g.code || ''} className="bg-slate-900">
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {modalType === 'JABATAN' && (
                <div>
                  <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                    Pilih Jabatan
                  </label>
                  <select
                    value={editJabatan}
                    onChange={e => setEditJabatan(e.target.value)}
                    className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                  >
                    {references.Jabatan.map((j, i) => (
                      <option key={i} value={j.id || j.code || j.name} className="bg-slate-900">
                        {toProperCase(j.name)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalType === 'ATASAN' && (
                <div>
                  <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                    Nama Atasan Langsung
                  </label>
                  <input
                    type="text"
                    value={editAtasan}
                    onChange={e => setEditAtasan(e.target.value)}
                    className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                  />
                </div>
              )}

              {modalType === 'USERNAME' && (
                <div>
                  <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                    Username Baru
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                  />
                </div>
              )}

              {modalType === 'PASSWORD' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                      Password Saat Ini
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Password saat ini"
                      className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                      Password Baru (min 6 karakter)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Password baru"
                      className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                      Konfirmasi Password Baru
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password baru"
                      className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#facc15] hover:bg-[#eab308] text-slate-900 rounded-full text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
