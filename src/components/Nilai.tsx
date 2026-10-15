import React, { useState, useEffect } from 'react';
import { Save, Award } from 'lucide-react';
import { PengajaranItem, SiswaItem } from '../types';
import { callGasApi } from '../services/gasApi';

interface NilaiProps {
  token: string;
  pengajaranList: PengajaranItem[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const Nilai: React.FC<NilaiProps> = ({ token, pengajaranList, showToast }) => {
  const [selectedPengajaranId, setSelectedPengajaranId] = useState(
    pengajaranList.length > 0 ? `${pengajaranList[0].mapelId}|${pengajaranList[0].kelas}` : ''
  );
  const [semester, setSemester] = useState('Ganjil');
  const [selectedTarget, setSelectedTarget] = useState('act_1'); // act_1 ... act_16 or pas

  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [scoresMap, setScoresMap] = useState<Record<string, number | ''>>({}); // [siswaId]: score
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const curPengajaran = pengajaranList.find(
    p => `${p.mapelId}|${p.kelas}` === selectedPengajaranId
  ) || pengajaranList[0];

  const loadNilai = async () => {
    if (!curPengajaran) return;
    setLoading(true);
    try {
      const res = await callGasApi('getNilaiData', [
        token,
        curPengajaran.kelas,
        curPengajaran.mapelId,
        semester,
      ]);

      if (res && res.success) {
        setSiswaList(res.siswa || []);
        const loadedScores: Record<string, number | ''> = {};

        (res.siswa || []).forEach((s: SiswaItem) => {
          const sId = s.SiswaID || s.siswaId || '';
          if (selectedTarget === 'pas') {
            const val = res.pasMap?.[sId];
            loadedScores[sId] = val !== undefined && val !== null ? val : '';
          } else {
            const val = res.aktivitasMap?.[sId]?.[selectedTarget];
            loadedScores[sId] = val !== undefined && val !== null ? val : '';
          }
        });
        setScoresMap(loadedScores);
        setIsDirty(false);
      }
    } catch {
      showToast('Gagal memuat data nilai.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNilai();
  }, [selectedPengajaranId, semester, selectedTarget]);

  const handleScoreChange = (siswaId: string, valStr: string) => {
    setIsDirty(true);
    if (valStr === '') {
      setScoresMap(prev => ({ ...prev, [siswaId]: '' }));
      return;
    }
    const num = Math.min(100, Math.max(0, parseInt(valStr, 10) || 0));
    setScoresMap(prev => ({ ...prev, [siswaId]: num }));
  };

  const handleSave = async () => {
    if (!curPengajaran) return;
    setSaving(true);
    try {
      const payload = {
        mapelId: curPengajaran.mapelId,
        kelas: curPengajaran.kelas,
        semester: semester,
        target: selectedTarget,
        scores: scoresMap,
      };

      const res = await callGasApi('saveNilaiData', [token, payload]);
      if (res && res.success) {
        showToast('Nilai peserta didik berhasil disimpan!', 'success');
        setIsDirty(false);
      } else {
        showToast(res?.message || 'Gagal menyimpan nilai.', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3.5 pb-28">
      {/* Filters Card */}
      <div className="bg-white/15 backdrop-blur-md p-3 rounded-2xl shadow-xl flex items-center space-x-2 border border-white/10">
        <div className="flex-1">
          <select
            value={selectedPengajaranId}
            onChange={e => setSelectedPengajaranId(e.target.value)}
            className="w-full bg-[#002830] border border-white/20 rounded-xl p-2 text-xs font-bold text-white outline-none cursor-pointer"
          >
            {pengajaranList.map((p, idx) => (
              <option key={idx} value={`${p.mapelId}|${p.kelas}`}>
                {p.mapelNama || p.mapelId} - Kelas {p.kelas}
              </option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <select
            value={semester}
            onChange={e => setSemester(e.target.value)}
            className="w-full bg-[#002830] border border-white/20 rounded-xl p-2 text-xs font-bold text-white outline-none cursor-pointer"
          >
            <option value="Ganjil">Sem. Ganjil</option>
            <option value="Genap">Sem. Genap</option>
          </select>
        </div>
      </div>

      {/* Target selector */}
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-4 text-white shadow-xl border border-white/15 space-y-3.5">
        <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
          <label className="block text-[10px] font-extrabold text-[#fde047] uppercase tracking-wider mb-1.5">
            Pilih Komponen / Aktivitas Penilaian
          </label>
          <select
            value={selectedTarget}
            onChange={e => setSelectedTarget(e.target.value)}
            className="w-full bg-[#002830] border border-white/20 rounded-xl p-2.5 text-xs font-bold text-white outline-none cursor-pointer"
          >
            {Array.from({ length: 16 }, (_, i) => i + 1).map(num => (
              <option key={num} value={`act_${num}`}>
                Aktivitas {num} (Formatif / Harian {num})
              </option>
            ))}
            <option value="pas">Ujian PAS / Akhir Semester</option>
          </select>
        </div>

        {/* Student Cards List */}
        <div className="space-y-1.5 max-h-[calc(100vh-390px)] min-h-[220px] overflow-y-auto touch-scroll pr-1 pb-3">
          {loading ? (
            <div className="text-center py-12 text-[#fde047] text-xs font-bold shimmer-box">
              Memuat data penilaian...
            </div>
          ) : siswaList.length > 0 ? (
            siswaList.map((s, idx) => {
              const sId = s.SiswaID || s.siswaId || `s-${idx}`;
              const scoreVal = scoresMap[sId] !== undefined ? scoresMap[sId] : '';

              return (
                <div
                  key={sId}
                  className="flex items-center justify-between p-2.5 bg-white/10 hover:bg-white/15 rounded-2xl border border-white/10 transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-white truncate">
                      {idx + 1}. {s.NamaSiswa || s.namaSiswa || s.nama || '-'}
                    </p>
                    <p className="text-[10px] text-white/60 font-mono">
                      NIS: {s.NIS || s.nis || '-'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scoreVal}
                      onChange={e => handleScoreChange(sId, e.target.value)}
                      placeholder="0-100"
                      className="w-16 bg-white/20 border border-white/30 rounded-xl py-1.5 px-2 text-center text-xs font-black text-[#fde047] placeholder-white/30 outline-none focus:border-[#facc15] focus:ring-1 focus:ring-[#facc15]"
                    />
                    <span className="text-[10px] font-bold text-white/60">/ 100</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs font-medium">
              Tidak ada data siswa untuk kelas ini.
            </div>
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-[74px] md:bottom-4 left-3 right-3 max-w-[456px] md:max-w-[720px] mx-auto z-30 pointer-events-auto">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`w-full py-3.5 rounded-2xl shadow-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isDirty && !saving
              ? 'bg-[#facc15] hover:bg-[#eab308] text-slate-900 active:scale-95'
              : 'bg-white/20 text-white/40 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Menyimpan...' : 'Simpan Data Nilai'}</span>
        </button>
      </div>
    </div>
  );
};
