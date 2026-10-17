import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  LkhRecord,
  MasterAjarData,
  PengajaranItem,
  ReferencesMap,
  User,
} from '../types';
import { DEFAULT_REFERENCES } from '../services/gasApi';
import {
  MAN1_LOGO_BASE64,
  FALLBACK_TTD_BASE64,
  FALLBACK_PARAF_BASE64,
} from './lkhLogoAsset';

const SHORT_MONTH_NAMES_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const FULL_MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const DAY_NAMES_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

export function normalizeIsoDateLkh(dateVal: unknown): string {
  if (!dateVal) return '';
  const clean = String(dateVal).trim();
  if (!clean) return '';

  const plainIsoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (plainIsoMatch) {
    return `${plainIsoMatch[1]}-${plainIsoMatch[2].padStart(2, '0')}-${plainIsoMatch[3].padStart(2, '0')}`;
  }

  if (clean.includes('T')) {
    const parsedDate = new Date(clean);
    if (!isNaN(parsedDate.getTime())) {
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Jakarta',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(parsedDate);
        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        const d = parts.find(p => p.type === 'day')?.value;
        if (y && m && d) {
          return `${y}-${m}-${d}`;
        }
      } catch {}
      const y = parsedDate.getFullYear();
      const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const d = String(parsedDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const prefixIsoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (prefixIsoMatch) {
    return `${prefixIsoMatch[1]}-${prefixIsoMatch[2].padStart(2, '0')}-${prefixIsoMatch[3].padStart(2, '0')}`;
  }

  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  const fallbackDate = new Date(clean);
  if (!isNaN(fallbackDate.getTime())) {
    const y = fallbackDate.getFullYear();
    const m = String(fallbackDate.getMonth() + 1).padStart(2, '0');
    const d = String(fallbackDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

export function formatHariTanggalShortId(dateStr: string): string {
  if (!dateStr) return '-';
  const norm = normalizeIsoDateLkh(dateStr);
  const isoMatch = norm.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (monthIdx >= 0 && monthIdx < 12) {
      const dObj = new Date(year, monthIdx, day);
      const dayName = DAY_NAMES_ID[dObj.getDay()] || '';
      return `${dayName}, ${String(day).padStart(2, '0')}-${String(monthIdx + 1).padStart(2, '0')}-${year}`;
    }
  }
  return dateStr;
}

export function formatLongDateId(dateStr: string): string {
  if (!dateStr) return '-';
  const norm = normalizeIsoDateLkh(dateStr);
  const isoMatch = norm.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${FULL_MONTH_NAMES_ID[monthIdx]} ${year}`;
    }
  }
  return dateStr;
}

export function formatPeriodeTexts(
  startDateStr: string,
  endDateStr: string
): {
  coverPeriodeText: string;
  headerPeriodeText: string;
  yearText: string;
  monthUpperText: string;
} {
  const normStart = normalizeIsoDateLkh(startDateStr);
  const normEnd = normalizeIsoDateLkh(endDateStr) || normStart;

  const m1 = normStart.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const m2 = normEnd.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (m1 && m2) {
    const y1 = m1[1];
    const mo1 = parseInt(m1[2], 10) - 1;
    const y2 = m2[1];
    const mo2 = parseInt(m2[2], 10) - 1;

    const monthName1 = FULL_MONTH_NAMES_ID[mo1] || '';
    const monthName2 = FULL_MONTH_NAMES_ID[mo2] || '';

    if (y1 === y2 && mo1 === mo2) {
      return {
        coverPeriodeText: `PERIODE BULAN ${monthName1.toUpperCase()} TAHUN ${y1}`,
        headerPeriodeText: `Bulan ${monthName1} Tahun ${y1}`,
        yearText: y1,
        monthUpperText: monthName1.toUpperCase(),
      };
    }

    if (y1 === y2) {
      return {
        coverPeriodeText: `PERIODE BULAN ${monthName1.toUpperCase()} - ${monthName2.toUpperCase()} TAHUN ${y1}`,
        headerPeriodeText: `Bulan ${monthName1} - ${monthName2} Tahun ${y1}`,
        yearText: y1,
        monthUpperText: `${monthName1.toUpperCase()} - ${monthName2.toUpperCase()}`,
      };
    }

    return {
      coverPeriodeText: `PERIODE ${monthName1.toUpperCase()} ${y1} - ${monthName2.toUpperCase()} ${y2}`,
      headerPeriodeText: `${monthName1} ${y1} - ${monthName2} ${y2}`,
      yearText: y2,
      monthUpperText: `${monthName1.toUpperCase()} - ${monthName2.toUpperCase()}`,
    };
  }

  const curMo = new Date().getMonth();
  const fallbackMonth = (FULL_MONTH_NAMES_ID[curMo] || 'SEPTEMBER').toUpperCase();
  const fallbackYear = new Date().getFullYear().toString();
  return {
    coverPeriodeText: `PERIODE TAHUN ${fallbackYear}`,
    headerPeriodeText: `Tahun ${fallbackYear}`,
    yearText: fallbackYear,
    monthUpperText: fallbackMonth,
  };
}

export function parseIsNonKbmRecord(rawVal: unknown): boolean {
  if (typeof rawVal === 'boolean') return rawVal;
  if (typeof rawVal === 'number') return rawVal === 1;
  if (typeof rawVal === 'string') {
    const upper = rawVal.trim().toUpperCase();
    if (upper === 'TRUE' || upper === '1' || upper === 'YA' || upper === 'NON-KBM') {
      return true;
    }
  }
  return false;
}

export function parseJamKeSummary(raw: any): {
  display: string;
  sortOrder: number;
} {
  const rawJamKe = String(raw?.JamKe ?? raw?.jamKe ?? '').trim();
  const rawMulai = raw?.JamMulai ?? raw?.jamMulai ?? '';
  const rawSelesai = raw?.JamSelesai ?? raw?.jamSelesai ?? '';

  if (rawJamKe && rawJamKe !== '-') {
    const nums = rawJamKe.match(/\d+/g);
    if (nums && nums.length >= 2) {
      const m = parseInt(nums[0], 10);
      const s = parseInt(nums[1], 10);
      return {
        display: m === s ? `${m}` : `${m}-${s}`,
        sortOrder: m,
      };
    }
    if (nums && nums.length === 1) {
      const m = parseInt(nums[0], 10);
      return {
        display: `${m}`,
        sortOrder: m,
      };
    }
    return { display: rawJamKe, sortOrder: 99 };
  }

  if (rawMulai !== '' && rawSelesai !== '') {
    const m = Number(rawMulai);
    const s = Number(rawSelesai);
    if (!isNaN(m) && !isNaN(s)) {
      return {
        display: m === s ? `${m}` : `${m}-${s}`,
        sortOrder: m,
      };
    }
  }

  if (rawMulai !== '' && !isNaN(Number(rawMulai))) {
    const m = Number(rawMulai);
    return { display: `${m}`, sortOrder: m };
  }

  if (rawSelesai !== '' && !isNaN(Number(rawSelesai))) {
    const s = Number(rawSelesai);
    return { display: `${s}`, sortOrder: s };
  }

  return { display: '', sortOrder: 99 };
}

/**
 * Resolusi Nama Mata Pelajaran Utama Guru dari berbagai sumber
 * (MasterAjarData prop -> pengajaranList isUtama -> localStorage ajar_master_ajar -> fallback)
 */
export function resolvePrimaryMapelName(params: {
  masterAjarData?: MasterAjarData | null;
  pengajaranList?: PengajaranItem[];
  references?: ReferencesMap;
  currentUser?: User | null;
  lkhRecords?: LkhRecord[];
}): string {
  const {
    masterAjarData,
    pengajaranList = [],
    references,
    currentUser,
    lkhRecords = [],
  } = params;

  const mapelRefList =
    references?.MataPelajaran && references.MataPelajaran.length > 0
      ? references.MataPelajaran
      : DEFAULT_REFERENCES.MataPelajaran;

  const lookupMapelName = (idOrCode: string, explicitName?: string): string => {
    const cleanId = String(idOrCode || '').trim();
    const cleanExplicit = String(explicitName || '').trim();
    if (cleanExplicit && cleanExplicit !== cleanId && !/^MP\d+$/i.test(cleanExplicit)) {
      return cleanExplicit;
    }
    if (!cleanId) return cleanExplicit || '';
    const found = mapelRefList.find(
      m => m.id === cleanId || m.code === cleanId || m.name === cleanId
    );
    if (found) return found.name || found.code || cleanId;
    return cleanExplicit || cleanId;
  };

  // 1. Dari masterAjarData prop langsung
  if (masterAjarData) {
    if (masterAjarData.mapelUtama?.mapelId || masterAjarData.mapelUtama?.mapelNama) {
      const resolved = lookupMapelName(
        masterAjarData.mapelUtama.mapelId,
        masterAjarData.mapelUtama.mapelNama
      );
      if (resolved) return resolved;
    }
    if (masterAjarData.mapelUtamaId || masterAjarData.mapelUtamaNama) {
      const resolved = lookupMapelName(
        masterAjarData.mapelUtamaId,
        masterAjarData.mapelUtamaNama
      );
      if (resolved) return resolved;
    }
  }

  // 2. Dari pengajaranList yang bertanda isUtama === true atau jenisMapel === 'Utama'
  const utamaItem = pengajaranList.find(
    p =>
      p.isUtama === true ||
      String(p.jenisMapel || '')
        .toLowerCase()
        .includes('utama')
  );
  if (utamaItem) {
    const resolved = lookupMapelName(
      utamaItem.mapelId || utamaItem.MataPelajaranID || '',
      utamaItem.mapelNama
    );
    if (resolved) return resolved;
  }

  // 3. Dari cache localStorage Master Ajar milik guru
  try {
    const keysToTry = [
      currentUser?.userId ? `ajar_master_ajar_${currentUser.userId}` : null,
      currentUser?.nip ? `ajar_master_ajar_${currentUser.nip}` : null,
      currentUser?.username ? `ajar_master_ajar_${currentUser.username}` : null,
      'ajar_master_ajar',
    ].filter(Boolean) as string[];

    for (const k of keysToTry) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.mapelUtama?.mapelId || parsed?.mapelUtama?.mapelNama) {
        const resolved = lookupMapelName(
          parsed.mapelUtama.mapelId,
          parsed.mapelUtama.mapelNama
        );
        if (resolved) return resolved;
      }
      if (parsed?.mapelUtamaId || parsed?.mapelUtamaNama) {
        const resolved = lookupMapelName(parsed.mapelUtamaId, parsed.mapelUtamaNama);
        if (resolved) return resolved;
      }
      if (Array.isArray(parsed?.pengajaran)) {
        const pUtama = parsed.pengajaran.find((p: any) => p.isUtama === true);
        if (pUtama) {
          const resolved = lookupMapelName(
            pUtama.mapelId || pUtama.MataPelajaranID || '',
            pUtama.mapelNama
          );
          if (resolved) return resolved;
        }
      }
    }
  } catch {}

  // 4. Dari item pertama di pengajaranList
  if (pengajaranList.length > 0) {
    const first = pengajaranList[0];
    const resolved = lookupMapelName(
      first.mapelId || first.MataPelajaranID || '',
      first.mapelNama
    );
    if (resolved) return resolved;
  }

  // 5. Fallback dari catatan LKH KBM
  for (const r of lkhRecords) {
    const mId = String(r.MataPelajaranID || r.mapelId || '').trim();
    if (mId && mId !== '-') {
      const resolved = lookupMapelName(mId, r.mapelNama);
      if (resolved) return resolved;
    }
  }

  // 6. Dari analisa teks jabatan currentUser (misal "GURU EKONOMI AHLI PERTAMA")
  if (currentUser?.jabatan) {
    const jab = currentUser.jabatan.toUpperCase();
    for (const m of mapelRefList) {
      if (m.name && jab.includes(m.name.toUpperCase())) {
        return m.name.toUpperCase();
      }
    }
  }

  return 'EKONOMI';
}

/**
 * Menggambar Logo Kementerian Agama ("Ikhlas Beramal") beresolusi tinggi ke Data URL PNG
 * agar tampil tajam dan presisi pada sampul PDF serta dokumen Word.
 */
let cachedKemenagLogoDataUrl: string | null = null;

export function getKemenagLogoDataUrl(): string {
  if (cachedKemenagLogoDataUrl) return cachedKemenagLogoDataUrl;
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = 260;
  const cy = 248;

  // Helper menggambar perisai segilima membulat khas Kemenag
  const traceShieldPath = (scale: number) => {
    const pts = [
      { x: cx, y: cy - 210 * scale }, // Puncak atas
      { x: cx + 205 * scale, y: cy - 62 * scale }, // Bahu kanan atas
      { x: cx + 132 * scale, y: cy + 195 * scale }, // Sudut kanan bawah
      { x: cx - 132 * scale, y: cy + 195 * scale }, // Sudut kiri bawah
      { x: cx - 205 * scale, y: cy - 62 * scale }, // Bahu kiri atas
    ];
    const r = 34 * scale;
    ctx.beginPath();
    ctx.moveTo((pts[4].x + pts[0].x) / 2, (pts[4].y + pts[0].y) / 2);
    for (let i = 0; i < 5; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % 5];
      ctx.arcTo(p1.x, p1.y, p2.x, p2.y, r);
    }
    ctx.closePath();
  };

  // 1. Perisai Luar (Garis Emas & Isi Hijau Tua Kemenag)
  traceShieldPath(1.0);
  ctx.fillStyle = '#006633';
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#F2C314';
  ctx.stroke();

  // Garis tipis bagian dalam perisai
  traceShieldPath(0.93);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#F2C314';
  ctx.stroke();

  // 2. Bintang Bersudut 5 di Puncak Atas + 5 Sinar Emas
  const starX = cx;
  const starY = cy - 115;

  // Sinar bawah bintang
  const rayAngles = [-55, -28, 0, 28, 55];
  ctx.strokeStyle = '#F2C314';
  ctx.lineWidth = 3.5;
  rayAngles.forEach((deg, idx) => {
    const rad = ((deg + 90) * Math.PI) / 180;
    const len = idx === 2 ? 42 : idx === 1 || idx === 3 ? 36 : 30;
    ctx.beginPath();
    ctx.moveTo(starX + Math.cos(rad) * 18, starY + Math.sin(rad) * 18);
    ctx.lineTo(starX + Math.cos(rad) * (18 + len), starY + Math.sin(rad) * (18 + len));
    ctx.stroke();
  });

  // Bintang Emas
  ctx.beginPath();
  const outerR = 32;
  const innerR = 13;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const x = starX + Math.cos(angle) * r;
    const y = starY + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#F2C314';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#004D26';
  ctx.stroke();

  // 3. Kitab Suci Terbuka di Tengah beserta Alas (Rehal)
  const bookY = cy - 12;
  // Halaman Kiri
  ctx.beginPath();
  ctx.moveTo(cx, bookY - 22);
  ctx.quadraticCurveTo(cx - 32, bookY - 30, cx - 64, bookY - 20);
  ctx.lineTo(cx - 64, bookY + 34);
  ctx.quadraticCurveTo(cx - 32, bookY + 24, cx, bookY + 34);
  ctx.closePath();
  ctx.fillStyle = '#F2C314';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#004D26';
  ctx.stroke();

  // Halaman Kanan
  ctx.beginPath();
  ctx.moveTo(cx, bookY - 22);
  ctx.quadraticCurveTo(cx + 32, bookY - 30, cx + 64, bookY - 20);
  ctx.lineTo(cx + 64, bookY + 34);
  ctx.quadraticCurveTo(cx + 32, bookY + 24, cx, bookY + 34);
  ctx.closePath();
  ctx.fillStyle = '#F2C314';
  ctx.fill();
  ctx.stroke();

  // Garis-garis lembaran kitab
  ctx.strokeStyle = '#006633';
  ctx.lineWidth = 2;
  for (let row = -10; row <= 18; row += 9) {
    ctx.beginPath();
    ctx.moveTo(cx - 54, bookY + row);
    ctx.quadraticCurveTo(cx - 28, bookY + row - 5, cx - 8, bookY + row + 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 8, bookY + row + 2);
    ctx.quadraticCurveTo(cx + 28, bookY + row - 5, cx + 54, bookY + row);
    ctx.stroke();
  }

  // Alas / Penyangga Kitab
  ctx.fillStyle = '#F2C314';
  ctx.strokeStyle = '#004D26';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.rect(cx - 72, bookY + 35, 144, 10);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 56, bookY + 45);
  ctx.lineTo(cx + 56, bookY + 45);
  ctx.lineTo(cx + 42, bookY + 64);
  ctx.lineTo(cx - 42, bookY + 64);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 4. Rangkaian Kapas (Kiri) & Padi (Kanan) Melengkung
  // Tangkai Melengkung Kiri (Kapas)
  ctx.strokeStyle = '#1E824C';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy - 18, 128, 0.62 * Math.PI, 1.32 * Math.PI, false);
  ctx.stroke();

  // Tangkai Melengkung Kanan (Padi)
  ctx.strokeStyle = '#F2C314';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy - 18, 128, -0.32 * Math.PI, 0.38 * Math.PI, false);
  ctx.stroke();

  // Butir-butir Kapas (Putih & Kelopak Hijau Muda) di Sisi Kiri
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const angle = (0.68 + t * 0.62) * Math.PI;
    const bx = cx + Math.cos(angle) * 128;
    const by = cy - 18 + Math.sin(angle) * 128;

    // Kelopak Hijau
    ctx.beginPath();
    ctx.arc(bx, by + 3, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#2ECC71';
    ctx.fill();

    // Bunga Kapas Putih
    ctx.beginPath();
    ctx.arc(bx, by - 2, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#004D26';
    ctx.stroke();
  }

  // Butir-butir Padi Emas di Sisi Kanan
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const angle = (-0.30 + t * 0.66) * Math.PI;
    const bx = cx + Math.cos(angle) * 128;
    const by = cy - 18 + Math.sin(angle) * 128;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle + Math.PI / 2);

    ctx.beginPath();
    ctx.ellipse(-6, 0, 7, 3.8, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#F2C314';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#004D26';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(6, 0, 7, 3.8, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#F2C314';
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // Simpul Ikatan di Bawah Kitab
  ctx.beginPath();
  ctx.arc(cx, cy + 108, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#F2C314';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#004D26';
  ctx.stroke();

  // 5. Pita "IKHLAS BERAMAL" di Bagian Bawah Perisai
  const ribbonY = cy + 132;
  ctx.beginPath();
  ctx.moveTo(cx - 122, ribbonY - 12);
  ctx.quadraticCurveTo(cx, ribbonY + 4, cx + 122, ribbonY - 12);
  ctx.lineTo(cx + 114, ribbonY + 18);
  ctx.quadraticCurveTo(cx, ribbonY + 34, cx - 114, ribbonY + 18);
  ctx.closePath();
  ctx.fillStyle = '#004D26';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#F2C314';
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px "Times New Roman", Times, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('IKHLAS BERAMAL', cx, ribbonY + 7);

  cachedKemenagLogoDataUrl = canvas.toDataURL('image/png');
  return cachedKemenagLogoDataUrl;
}

export interface LkhExportGroupRow {
  isFirstOfDate: boolean;
  dateRowSpan: number;
  groupNo: number;
  hariTanggalLabel: string;
  jamKeDisplay: string;
  isNonKbm: boolean;
  hasJamKe: boolean;
  kelasDisplay: string;
  uraianDisplay: string;
  hasilDisplay: string;
  mergedNonKbmText: string;
}

export function buildLkhExportRows(records: LkhRecord[]): LkhExportGroupRow[] {
  // Urutkan berdasarkan tanggal naik, lalu jam ke naik
  const sorted = [...records].sort((a, b) => {
    const dA = normalizeIsoDateLkh(a.Tanggal || a.tanggal || '');
    const dB = normalizeIsoDateLkh(b.Tanggal || b.tanggal || '');
    if (dA !== dB) return dA.localeCompare(dB);
    const jA = parseJamKeSummary(a).sortOrder;
    const jB = parseJamKeSummary(b).sortOrder;
    return jA - jB;
  });

  // Kelompokkan per tanggal
  const groupsMap = new Map<string, LkhRecord[]>();
  sorted.forEach(rec => {
    const iso = normalizeIsoDateLkh(rec.Tanggal || rec.tanggal || '') || '-';
    const list = groupsMap.get(iso) || [];
    list.push(rec);
    groupsMap.set(iso, list);
  });

  const result: LkhExportGroupRow[] = [];
  let groupCounter = 0;

  groupsMap.forEach((groupList, isoDate) => {
    groupCounter += 1;
    const span = groupList.length;
    const hariTanggalLabel = formatHariTanggalShortId(isoDate);

    groupList.forEach((rec, idxInGroup) => {
      const isNonKbm = parseIsNonKbmRecord(
        rec.HariNonKBM ?? rec.IsNonKbm ?? rec.isNonKbm
      );
      const { display: jamKeRaw } = parseJamKeSummary(rec);
      const hasJamKe = Boolean(jamKeRaw && jamKeRaw !== '-');

      const cleanUraian = String(rec.UraianKerja || rec.uraian || '-')
        .replace(/^\[Non-KBM\]\s*/i, '')
        .trim();
      const cleanHasil = String(
        rec.Hasil || rec.HasilPembelajaran || rec.hasil || ''
      ).trim();

      const kelasVal = String(rec.Kelas || rec.kelas || '').trim();
      const kelasDisplay = isNonKbm ? '' : kelasVal || '-';

      let mergedNonKbmText = cleanUraian;
      if (
        cleanHasil &&
        cleanHasil !== '-' &&
        cleanHasil.toLowerCase() !== cleanUraian.toLowerCase()
      ) {
        mergedNonKbmText = `${cleanUraian}`;
      }

      result.push({
        isFirstOfDate: idxInGroup === 0,
        dateRowSpan: idxInGroup === 0 ? span : 0,
        groupNo: groupCounter,
        hariTanggalLabel,
        jamKeDisplay: hasJamKe ? jamKeRaw : isNonKbm ? '' : '-',
        isNonKbm,
        hasJamKe,
        kelasDisplay,
        uraianDisplay: cleanUraian || '-',
        hasilDisplay: cleanHasil || '-',
        mergedNonKbmText,
      });
    });
  });

  return result;
}

export interface OfficialLkhExportOptions {
  filename: string;
  startDate: string;
  endDate: string;
  currentUser: User | null;
  primaryMapelName: string;
  records: LkhRecord[];
}

/**
 * 1. EKSPOR PDF RESMI LKH (Sama Persis Seperti Contoh LKH_Yuni_1Sep2026-30Sep2026.pdf)
 * - Halaman 1: Sampul (Cover) A4 Portrait dengan Logo Kementerian Agama & Identitas Guru (Mata Pelajaran Utama)
 * - Halaman 2+: Tabel Laporan Kinerja Harian dengan merge tanggal/nomor & merge baris Non-KBM + Blok Pengesahan
 */
export function exportLkhOfficialPdf(options: OfficialLkhExportOptions): void {
  const {
    filename,
    startDate,
    endDate,
    currentUser,
    primaryMapelName,
    records,
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const centerX = pageWidth / 2;

  const guruNama =
    currentUser?.namaTampilan ||
    [
      currentUser?.gelarDepan,
      currentUser?.namaLengkap,
      currentUser?.gelarBelakang,
    ]
      .filter(Boolean)
      .join(' ') ||
    'YUNI ANGGARENI NUR, S.Pd';
  const guruNip = currentUser?.nip || '199612182023212018';
  const mapelUtama = (primaryMapelName || 'EKONOMI').toUpperCase();

  // Format jabatan (misal: "GURU EKONOMI AHLI PERTAMA")
  let guruJabatan = (
    currentUser?.jabatan ||
    currentUser?.jabatanId ||
    ''
  ).toUpperCase();
  if (!guruJabatan || guruJabatan === 'GURU MATA PELAJARAN') {
    guruJabatan = `GURU ${mapelUtama} AHLI PERTAMA`;
  }

  const atasanNama =
    currentUser?.namaAtasan || 'Iyan Arif Hasyim, S.Pd, M.Pd';
  const atasanNip =
    (currentUser as any)?.nipAtasan || '196904242005011008';

  const parafUrl =
    currentUser?.parafUrl ||
    (currentUser as any)?.ParafGuruURL ||
    FALLBACK_PARAF_BASE64;
  const ttdUrl =
    currentUser?.parafUrl ||
    (currentUser as any)?.ParafGuruURL ||
    FALLBACK_TTD_BASE64;

  const { yearText, monthUpperText } = formatPeriodeTexts(
    startDate,
    endDate
  );

  // ===========================================================================
  // HALAMAN 1: SAMPUL (COVER) LAPORAN KINERJA HARIAN (100% IDENTIK ACUAN)
  // ===========================================================================
  doc.setFont('times', 'bold');
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(14);
  doc.text('LAPORAN KINERJA HARIAN', centerX, 36, { align: 'center' });

  doc.setFontSize(11.5);
  doc.text(
    'PEGAWAI PEMERINTAH DENGAN PERJANJIAN KERJA (PPPK)',
    centerX,
    43,
    { align: 'center' }
  );
  doc.text('KEMENTERIAN AGAMA', centerX, 50, { align: 'center' });

  // Logo Resmi MAN 1 Majalengka Asli di Tengah Sampul
  const logoW = 54;
  const logoH = 54;
  doc.addImage(
    MAN1_LOGO_BASE64,
    'PNG',
    centerX - logoW / 2,
    72,
    logoW,
    logoH
  );

  // Blok Identitas Guru di Tengah Sampul (Titik Dua Sejajar Vertikal)
  const coverLabelX = 52;
  const coverColonX = 84;
  const coverValueX = 88;
  const coverIdentityY = 158;
  const coverGap = 7;

  doc.setFont('times', 'bold');
  doc.setFontSize(11);

  doc.text('NAMA', coverLabelX, coverIdentityY);
  doc.text(':', coverColonX, coverIdentityY);
  doc.text(guruNama.toUpperCase(), coverValueX, coverIdentityY);

  doc.text('NIP', coverLabelX, coverIdentityY + coverGap);
  doc.text(':', coverColonX, coverIdentityY + coverGap);
  doc.text(guruNip, coverValueX, coverIdentityY + coverGap);

  doc.text('JABATAN', coverLabelX, coverIdentityY + coverGap * 2);
  doc.text(':', coverColonX, coverIdentityY + coverGap * 2);
  doc.text(guruJabatan, coverValueX, coverIdentityY + coverGap * 2);

  doc.text('BULAN', coverLabelX, coverIdentityY + coverGap * 3);
  doc.text(':', coverColonX, coverIdentityY + coverGap * 3);
  doc.text(monthUpperText, coverValueX, coverIdentityY + coverGap * 3);

  // Blok Instansi / Footer di Bawah Sampul
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('MADRASAH ALIYAH NEGERI 1 MAJALENGKA', centerX, 240, {
    align: 'center',
  });

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.text(
    'Jalan Jenderal Sudirman No. 29 Talaga Telp. (0233) 319298',
    centerX,
    246.5,
    { align: 'center' }
  );
  doc.text('MAJALENGKA 45463', centerX, 252.5, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text(`TAHUN ${yearText}`, centerX, 258.5, { align: 'center' });

  // ===========================================================================
  // HALAMAN 2+: ISI TABEL LAPORAN KINERJA HARIAN (100% IDENTIK ACUAN)
  // ===========================================================================
  doc.addPage('a4', 'portrait');

  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('LAPORAN KINERJA HARIAN', centerX, 18, { align: 'center' });
  doc.setFontSize(11);
  doc.text('GURU MAN 1 MAJALENGKA', centerX, 23.5, { align: 'center' });

  // Blok Identitas Guru di Atas Tabel (Uppercase, Bold, Titik Dua Sejajar)
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);

  const infoLabelX = 15;
  const infoColonX = 52;
  const infoValX = 55;
  const infoStartY = 31.5;
  const infoGap = 5;

  const infoRows: Array<[string, string]> = [
    ['NAMA', guruNama.toUpperCase()],
    ['NIP', guruNip],
    ['MATA PELAJARAN', mapelUtama],
    ['BULAN', monthUpperText],
  ];

  infoRows.forEach(([lbl, val], idx) => {
    const yPos = infoStartY + idx * infoGap;
    doc.text(lbl, infoLabelX, yPos);
    doc.text(':', infoColonX, yPos);
    doc.text(val, infoValX, yPos);
  });

  // Susun Baris Tabel dengan 7 Kolom (+ PARAF)
  const exportRows = buildLkhExportRows(records);

  const tableBody: any[] = exportRows.map(row => {
    const cells: any[] = [];

    // Kolom 0 & 1: NO & HARI, TANGGAL (hanya ditambahkan pada baris pertama dalam kelompok tanggal)
    if (row.isFirstOfDate) {
      cells.push({
        content: String(row.groupNo),
        rowSpan: row.dateRowSpan,
        styles: { halign: 'center', valign: 'top' },
      });
      cells.push({
        content: row.hariTanggalLabel,
        rowSpan: row.dateRowSpan,
        styles: { halign: 'left', valign: 'top' },
      });
    }

    if (row.isNonKbm) {
      if (!row.hasJamKe) {
        // Non-KBM tanpa Jam Ke: merge melintasi JAM KE- s/d HASIL (colSpan = 4)
        cells.push({
          content: row.mergedNonKbmText,
          colSpan: 4,
          styles: {
            halign: 'left',
            valign: 'middle',
            fontStyle: 'normal',
          },
        });
      } else {
        // Non-KBM dengan Jam Ke: tampilkan Jam Ke, lalu merge KELAS s/d HASIL (colSpan = 3)
        cells.push({
          content: row.jamKeDisplay,
          styles: { halign: 'center', valign: 'top' },
        });
        cells.push({
          content: row.mergedNonKbmText,
          colSpan: 3,
          styles: {
            halign: 'left',
            valign: 'top',
            fontStyle: 'normal',
          },
        });
      }
    } else {
      // Baris KBM Reguler
      cells.push({
        content: row.jamKeDisplay,
        styles: { halign: 'center', valign: 'top' },
      });
      cells.push({
        content: row.kelasDisplay,
        styles: { halign: 'center', valign: 'top' },
      });
      cells.push({
        content: row.uraianDisplay,
        styles: { halign: 'left', valign: 'top' },
      });
      cells.push({
        content: row.hasilDisplay,
        styles: { halign: 'left', valign: 'top' },
      });
    }

    // Kolom 6: PARAF (rowSpan per tanggal agar satu tanggal memiliki 1 sel paraf seperti acuan)
    if (row.isFirstOfDate) {
      cells.push({
        content: '',
        rowSpan: row.dateRowSpan,
        styles: { halign: 'center', valign: 'middle' },
      });
    }

    return cells;
  });

  if (tableBody.length === 0) {
    tableBody.push([
      {
        content: 'Tidak ada data kegiatan pada periode tanggal ini.',
        colSpan: 7,
        styles: { halign: 'center', fontStyle: 'italic' },
      },
    ]);
  }

  autoTable(doc, {
    startY: 53,
    margin: { left: 15, right: 15, top: 16, bottom: 16 },
    head: [
      [
        'NO',
        'HARI,\nTANGGAL',
        'JAM\nKE-',
        'KELAS',
        'URAIAN KERJA',
        'HASIL',
        'PARAF',
      ],
    ],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 8.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      cellPadding: 1.8,
      valign: 'top',
    },
    headStyles: {
      font: 'times',
      fontStyle: 'bold',
      fontSize: 9,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 30, halign: 'left' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 63, halign: 'left' },
      5: { cellWidth: 34, halign: 'left' },
      6: { cellWidth: 15, halign: 'center', valign: 'middle' },
    },
    didDrawCell: data => {
      // Render gambar paraf digital di kolom PARAF (index 6)
      if (data.section === 'body' && data.column.index === 6) {
        if (parafUrl) {
          const cellW = data.cell.width;
          const cellH = data.cell.height;
          // Ukuran proporsional gambar paraf di dalam sel
          const imgW = Math.min(cellW - 3, 12);
          const imgH = Math.min(cellH - 3, 9);
          const imgX = data.cell.x + (cellW - imgW) / 2;
          const imgY = data.cell.y + (cellH - imgH) / 2;
          try {
            doc.addImage(parafUrl, 'PNG', imgX, imgY, imgW, imgH);
          } catch {
            // fallback safe
          }
        }
      }
    },
  });

  // ===========================================================================
  // BLOK PENGESAHAN / TANDA TANGAN (100% IDENTIK HALAMAN 6 ACUAN)
  // ===========================================================================
  const finalY = (doc as any).lastAutoTable?.finalY || 75;
  let sigY = finalY + 12;

  // Jika sisa ruang halaman tidak cukup untuk blok pengesahan (~50mm), buat halaman baru persis seperti halaman 6 PDF acuan
  if (sigY + 50 > pageHeight - 16) {
    doc.addPage('a4', 'portrait');
    sigY = 25;
  }

  const leftSigX = 22;
  const rightSigX = 125;
  const tanggalTtd = formatLongDateId(endDate || startDate);

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);

  // Tanggal Pengesahan di Kanan Atas
  doc.text(`Majalengka, ${tanggalTtd}`, rightSigX, sigY);

  // Kiri: Mengetahui Atasan Langsung Plt. Kepala MAN 1 Majalengka
  doc.text('Mengetahui', leftSigX, sigY + 5.5);
  doc.text('Atasan Langsung', leftSigX, sigY + 10.5);
  doc.text('Plt. Kepala MAN 1 Majalengka', leftSigX, sigY + 15.5);

  // Kanan: Guru Mata Pelajaran
  doc.text('Guru Mata Pelajaran', rightSigX, sigY + 15.5);

  // Gambar Tanda Tangan Guru dari Profil
  if (ttdUrl) {
    const ttdW = 28;
    const ttdH = 15;
    const ttdImgX = rightSigX + 4;
    const ttdImgY = sigY + 19;
    try {
      doc.addImage(ttdUrl, 'PNG', ttdImgX, ttdImgY, ttdW, ttdH);
    } catch {
      // fallback safe
    }
  }

  // Nama Terang & NIP
  const nameY = sigY + 39;

  // Kiri: Atasan Langsung
  doc.setFont('times', 'bold');
  doc.text(atasanNama, leftSigX, nameY);
  const atasanWidth = doc.getTextWidth(atasanNama);
  doc.setLineWidth(0.3);
  doc.line(leftSigX, nameY + 0.8, leftSigX + atasanWidth, nameY + 0.8);

  doc.setFont('times', 'normal');
  doc.text(`NIP. ${atasanNip}`, leftSigX, nameY + 5.5);

  // Kanan: Guru
  doc.setFont('times', 'bold');
  doc.text(guruNama, rightSigX, nameY);
  const guruWidth = doc.getTextWidth(guruNama);
  doc.setLineWidth(0.3);
  doc.line(rightSigX, nameY + 0.8, rightSigX + guruWidth, nameY + 0.8);

  doc.setFont('times', 'normal');
  doc.text(`NIP. ${guruNip}`, rightSigX, nameY + 5.5);

  doc.save(filename);
}

/**
 * 2. EKSPOR WORD (.doc) RESMI LKH (Sama Persis dengan Struktur Sampul + Tabel + Pengesahan)
 */
export function exportLkhOfficialWord(options: OfficialLkhExportOptions): void {
  const {
    filename,
    startDate,
    endDate,
    currentUser,
    primaryMapelName,
    records,
  } = options;

  const guruNama =
    currentUser?.namaTampilan ||
    [
      currentUser?.gelarDepan,
      currentUser?.namaLengkap,
      currentUser?.gelarBelakang,
    ]
      .filter(Boolean)
      .join(' ') ||
    'YUNI ANGGARENI NUR, S.Pd';
  const guruNip = currentUser?.nip || '199612182023212018';
  const mapelUtama = (primaryMapelName || 'EKONOMI').toUpperCase();

  let guruJabatan = (
    currentUser?.jabatan ||
    currentUser?.jabatanId ||
    ''
  ).toUpperCase();
  if (!guruJabatan || guruJabatan === 'GURU MATA PELAJARAN') {
    guruJabatan = `GURU ${mapelUtama} AHLI PERTAMA`;
  }

  const atasanNama =
    currentUser?.namaAtasan || 'Iyan Arif Hasyim, S.Pd, M.Pd';
  const atasanNip =
    (currentUser as any)?.nipAtasan || '196904242005011008';

  const parafUrl =
    currentUser?.parafUrl ||
    (currentUser as any)?.ParafGuruURL ||
    FALLBACK_PARAF_BASE64;
  const ttdUrl =
    currentUser?.parafUrl ||
    (currentUser as any)?.ParafGuruURL ||
    FALLBACK_TTD_BASE64;

  const { yearText, monthUpperText } = formatPeriodeTexts(
    startDate,
    endDate
  );
  const exportRows = buildLkhExportRows(records);
  const tanggalTtd = formatLongDateId(endDate || startDate);

  let rowsHtml = '';
  if (exportRows.length === 0) {
    rowsHtml = `<tr><td colspan="7" style="text-align:center;font-style:italic;">Tidak ada data kegiatan pada periode tanggal ini.</td></tr>`;
  } else {
    exportRows.forEach(row => {
      rowsHtml += '<tr>';
      if (row.isFirstOfDate) {
        rowsHtml += `<td rowspan="${row.dateRowSpan}" style="text-align:center;vertical-align:top;">${row.groupNo}</td>`;
        rowsHtml += `<td rowspan="${row.dateRowSpan}" style="text-align:left;vertical-align:top;">${row.hariTanggalLabel}</td>`;
      }
      if (row.isNonKbm) {
        if (!row.hasJamKe) {
          rowsHtml += `<td colspan="4" style="text-align:left;vertical-align:middle;">${row.mergedNonKbmText}</td>`;
        } else {
          rowsHtml += `<td style="text-align:center;vertical-align:top;">${row.jamKeDisplay}</td>`;
          rowsHtml += `<td colspan="3" style="text-align:left;vertical-align:top;">${row.mergedNonKbmText}</td>`;
        }
      } else {
        rowsHtml += `<td style="text-align:center;vertical-align:top;">${row.jamKeDisplay}</td>`;
        rowsHtml += `<td style="text-align:center;vertical-align:top;">${row.kelasDisplay}</td>`;
        rowsHtml += `<td style="text-align:left;vertical-align:top;">${row.uraianDisplay}</td>`;
        rowsHtml += `<td style="text-align:left;vertical-align:top;">${row.hasilDisplay}</td>`;
      }
      if (row.isFirstOfDate) {
        rowsHtml += `<td rowspan="${row.dateRowSpan}" style="text-align:center;vertical-align:middle;">${
          parafUrl ? `<img src="${parafUrl}" width="48" height="32" alt="Paraf" />` : ''
        }</td>`;
      }
      rowsHtml += '</tr>';
    });
  }

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${filename}</title>
      <style>
        @page { size: 21cm 29.7cm; margin: 2cm 1.5cm; }
        body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000000; }
        table.lkh-grid { border-collapse: collapse; width: 100%; margin-top: 10pt; font-size: 9.5pt; }
        table.lkh-grid th, table.lkh-grid td { border: 1px solid #000000; padding: 5px 6px; vertical-align: top; }
        table.lkh-grid th { background-color: #FFFFFF; font-weight: bold; text-align: center; vertical-align: middle; }
        table.no-border td { border: none; padding: 2px 4px; font-size: 10.5pt; }
      </style>
    </head>
    <body>
      <!-- HALAMAN 1: SAMPUL -->
      <div style="text-align:center; margin-top: 24pt; font-weight:bold;">
        <div style="font-size:14pt;">LAPORAN KINERJA HARIAN</div>
        <div style="font-size:12pt; margin-top:4pt;">PEGAWAI PEMERINTAH DENGAN PERJANJIAN KERJA (PPPK)</div>
        <div style="font-size:12pt; margin-top:4pt;">KEMENTERIAN AGAMA</div>
      </div>

      <div style="text-align:center; margin-top: 36pt; margin-bottom: 28pt;">
        <img src="${MAN1_LOGO_BASE64}" width="165" height="165" alt="Logo MAN 1 Majalengka" />
      </div>

      <table class="no-border" style="margin: 0 auto; width: 72%; font-weight:bold; font-size:11pt;">
        <tr><td style="width:140px;">NAMA</td><td style="width:14px;">:</td><td>${guruNama.toUpperCase()}</td></tr>
        <tr><td>NIP</td><td>:</td><td>${guruNip}</td></tr>
        <tr><td>JABATAN</td><td>:</td><td>${guruJabatan}</td></tr>
        <tr><td>BULAN</td><td>:</td><td>${monthUpperText}</td></tr>
      </table>

      <div style="text-align:center; margin-top: 115pt; font-size:11pt;">
        <div style="font-weight:bold; font-size:12pt;">MADRASAH ALIYAH NEGERI 1 MAJALENGKA</div>
        <div style="margin-top:3pt;">Jalan Jenderal Sudirman No. 29 Talaga Telp. (0233) 319298</div>
        <div style="margin-top:2pt;">MAJALENGKA 45463</div>
        <div style="margin-top:3pt; font-weight:bold;">TAHUN ${yearText}</div>
      </div>

      <br clear="all" style="page-break-before:always" />

      <!-- HALAMAN 2: ISI LAPORAN KINERJA HARIAN -->
      <div style="text-align:center; font-weight:bold; font-size:12pt; margin-bottom:12pt;">
        <div>LAPORAN KINERJA HARIAN</div>
        <div style="font-size:11pt; margin-top:2pt;">GURU MAN 1 MAJALENGKA</div>
      </div>

      <table class="no-border" style="width:100%; margin-bottom:8pt; font-weight:bold; font-size:10pt;">
        <tr><td style="width:140px;">NAMA</td><td style="width:12px;">:</td><td>${guruNama.toUpperCase()}</td></tr>
        <tr><td>NIP</td><td>:</td><td>${guruNip}</td></tr>
        <tr><td>MATA PELAJARAN</td><td>:</td><td>${mapelUtama}</td></tr>
        <tr><td>BULAN</td><td>:</td><td>${monthUpperText}</td></tr>
      </table>

      <table class="lkh-grid">
        <thead>
          <tr>
            <th style="width:34px;">NO</th>
            <th style="width:115px;">HARI,<br/>TANGGAL</th>
            <th style="width:50px;">JAM<br/>KE-</th>
            <th style="width:50px;">KELAS</th>
            <th>URAIAN KERJA</th>
            <th style="width:130px;">HASIL</th>
            <th style="width:55px;">PARAF</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <table class="no-border" style="width:100%; margin-top:26pt;">
        <tr>
          <td style="width:52%; padding-left:18pt; vertical-align:top;">
            <div>Mengetahui</div>
            <div>Atasan Langsung</div>
            <div>Plt. Kepala MAN 1 Majalengka</div>
            <br/><br/><br/><br/>
            <div style="font-weight:bold; text-decoration:underline;">${atasanNama}</div>
            <div>NIP. ${atasanNip}</div>
          </td>
          <td style="width:48%; padding-left:24pt; vertical-align:top;">
            <div>Majalengka, ${tanggalTtd}</div>
            <div>Guru Mata Pelajaran</div>
            <div style="margin: 6px 0;">
              ${ttdUrl ? `<img src="${ttdUrl}" width="85" height="45" alt="TTD Guru" />` : '<br/><br/>'}
            </div>
            <div style="font-weight:bold; text-decoration:underline;">${guruNama}</div>
            <div>NIP. ${guruNip}</div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 3. EKSPOR EXCEL (.xlsx) RESMI LKH
 */
export function exportLkhOfficialExcel(options: OfficialLkhExportOptions): void {
  const {
    filename,
    startDate,
    endDate,
    currentUser,
    primaryMapelName,
    records,
  } = options;

  const guruNama =
    currentUser?.namaTampilan ||
    [
      currentUser?.gelarDepan,
      currentUser?.namaLengkap,
      currentUser?.gelarBelakang,
    ]
      .filter(Boolean)
      .join(' ') ||
    'YUNI ANGGARENI NUR, S.Pd';
  const guruNip = currentUser?.nip || '199612182023212018';
  const mapelUtama = (primaryMapelName || 'EKONOMI').toUpperCase();

  let guruJabatan = (
    currentUser?.jabatan ||
    currentUser?.jabatanId ||
    ''
  ).toUpperCase();
  if (!guruJabatan || guruJabatan === 'GURU MATA PELAJARAN') {
    guruJabatan = `GURU ${mapelUtama} AHLI PERTAMA`;
  }

  const atasanNama =
    currentUser?.namaAtasan || 'Iyan Arif Hasyim, S.Pd, M.Pd';
  const atasanNip =
    (currentUser as any)?.nipAtasan || '196904242005011008';

  const { yearText, monthUpperText } = formatPeriodeTexts(
    startDate,
    endDate
  );
  const tanggalTtd = formatLongDateId(endDate || startDate);
  const exportRows = buildLkhExportRows(records);

  const wb = XLSX.utils.book_new();

  // Sheet 1: Sampul
  const coverAoa: any[][] = [
    ['LAPORAN KINERJA HARIAN'],
    ['PEGAWAI PEMERINTAH DENGAN PERJANJIAN KERJA (PPPK)'],
    ['KEMENTERIAN AGAMA'],
    [],
    ['NAMA', ':', guruNama.toUpperCase()],
    ['NIP', ':', guruNip],
    ['JABATAN', ':', guruJabatan],
    ['BULAN', ':', monthUpperText],
    [],
    ['MADRASAH ALIYAH NEGERI 1 MAJALENGKA'],
    ['Jalan Jenderal Sudirman No. 29 Talaga Telp. (0233) 319298'],
    ['MAJALENGKA 45463'],
    [`TAHUN ${yearText}`],
  ];
  const wsCover = XLSX.utils.aoa_to_sheet(coverAoa);
  XLSX.utils.book_append_sheet(wb, wsCover, 'Sampul');

  // Sheet 2: Laporan Kinerja Harian
  const aoa: any[][] = [
    ['LAPORAN KINERJA HARIAN', '', '', '', '', '', ''],
    ['GURU MAN 1 MAJALENGKA', '', '', '', '', '', ''],
    [],
    ['NAMA', `: ${guruNama.toUpperCase()}`, '', '', '', '', ''],
    ['NIP', `: ${guruNip}`, '', '', '', '', ''],
    ['MATA PELAJARAN', `: ${mapelUtama}`, '', '', '', '', ''],
    ['BULAN', `: ${monthUpperText}`, '', '', '', '', ''],
    [],
    [
      'NO',
      'HARI, TANGGAL',
      'JAM KE-',
      'KELAS',
      'URAIAN KERJA',
      'HASIL',
      'PARAF',
    ],
  ];

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
  ];

  const tableStartRowIdx = aoa.length; // index 9

  exportRows.forEach((row, idx) => {
    const currentRowIdx = tableStartRowIdx + idx;

    if (row.isFirstOfDate && row.dateRowSpan > 1) {
      merges.push({
        s: { r: currentRowIdx, c: 0 },
        e: { r: currentRowIdx + row.dateRowSpan - 1, c: 0 },
      });
      merges.push({
        s: { r: currentRowIdx, c: 1 },
        e: { r: currentRowIdx + row.dateRowSpan - 1, c: 1 },
      });
      merges.push({
        s: { r: currentRowIdx, c: 6 },
        e: { r: currentRowIdx + row.dateRowSpan - 1, c: 6 },
      });
    }

    if (row.isNonKbm) {
      if (!row.hasJamKe) {
        aoa.push([
          row.isFirstOfDate ? row.groupNo : '',
          row.isFirstOfDate ? row.hariTanggalLabel : '',
          row.mergedNonKbmText,
          '',
          '',
          '',
          row.isFirstOfDate ? '✓' : '',
        ]);
        merges.push({
          s: { r: currentRowIdx, c: 2 },
          e: { r: currentRowIdx, c: 5 },
        });
      } else {
        aoa.push([
          row.isFirstOfDate ? row.groupNo : '',
          row.isFirstOfDate ? row.hariTanggalLabel : '',
          row.jamKeDisplay,
          row.mergedNonKbmText,
          '',
          '',
          row.isFirstOfDate ? '✓' : '',
        ]);
        merges.push({
          s: { r: currentRowIdx, c: 3 },
          e: { r: currentRowIdx, c: 5 },
        });
      }
    } else {
      aoa.push([
        row.isFirstOfDate ? row.groupNo : '',
        row.isFirstOfDate ? row.hariTanggalLabel : '',
        row.jamKeDisplay,
        row.kelasDisplay,
        row.uraianDisplay,
        row.hasilDisplay,
        row.isFirstOfDate ? '✓' : '',
      ]);
    }
  });

  aoa.push([]);
  aoa.push([
    '',
    'Mengetahui',
    '',
    '',
    `Majalengka, ${tanggalTtd}`,
    '',
    '',
  ]);
  aoa.push([
    '',
    'Atasan Langsung',
    '',
    '',
    'Guru Mata Pelajaran',
    '',
    '',
  ]);
  aoa.push([
    '',
    'Plt. Kepala MAN 1 Majalengka',
    '',
    '',
    '',
    '',
    '',
  ]);
  aoa.push([]);
  aoa.push([]);
  aoa.push(['', atasanNama, '', '', guruNama, '', '']);
  aoa.push(['', `NIP. ${atasanNip}`, '', '', `NIP. ${guruNip}`, '', '']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 6 },
    { wch: 20 },
    { wch: 10 },
    { wch: 10 },
    { wch: 46 },
    { wch: 34 },
    { wch: 10 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'LKH');
  XLSX.writeFile(wb, filename);
}
