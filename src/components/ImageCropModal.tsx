import React, { useState, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Move, RefreshCw } from 'lucide-react';
import { CropState, exportManualCroppedImage } from '../utils/imageProcessing';

interface ImageCropModalProps {
  imageSrc: string;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (result: { dataUrl: string; base64: string }) => void;
  title?: string;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
  title = 'Atur & Potong Foto (1:1)',
}) => {
  const [cropState, setCropState] = useState<CropState>({
    zoom: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Ukuran viewport crop 1:1 di modal
  const VIEWPORT_SIZE = 280;

  // Reset state saat modal dibuka dengan gambar baru
  useEffect(() => {
    if (isOpen) {
      setCropState({
        zoom: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      });
      setIsProcessing(false);
    }
  }, [isOpen, imageSrc]);

  // Pointer / Mouse events untuk drag manual
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - cropState.offsetX,
      y: e.clientY - cropState.offsetY,
    });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setCropState(prev => ({
        ...prev,
        offsetX: e.clientX - dragStart.x,
        offsetY: e.clientY - dragStart.y,
      }));
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch events untuk layar HP
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({
        x: touch.clientX - cropState.offsetX,
        y: touch.clientY - cropState.offsetY,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setCropState(prev => ({
      ...prev,
      offsetX: touch.clientX - dragStart.x,
      offsetY: touch.clientY - dragStart.y,
    }));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Zoom slider & buttons
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setCropState(prev => ({ ...prev, zoom: newZoom }));
  };

  const handleZoomIn = () => {
    setCropState(prev => ({
      ...prev,
      zoom: Math.min(3.5, Number((prev.zoom + 0.15).toFixed(2))),
    }));
  };

  const handleZoomOut = () => {
    setCropState(prev => ({
      ...prev,
      zoom: Math.max(1.0, Number((prev.zoom - 0.15).toFixed(2))),
    }));
  };

  const handleRotate = () => {
    setCropState(prev => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
    }));
  };

  const handleReset = () => {
    setCropState({
      zoom: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
    });
  };

  // Wheel zoom di area potong
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setCropState(prev => ({
      ...prev,
      zoom: Math.max(1.0, Math.min(3.5, Number((prev.zoom + delta).toFixed(2)))),
    }));
  };

  // Eksekusi potong manual dan kirim hasil
  const handleConfirmCrop = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await exportManualCroppedImage(
        imageSrc,
        cropState,
        VIEWPORT_SIZE,
        512
      );
      onCropComplete(result);
      onClose();
    } catch (err) {
      console.error('Gagal mengekspor hasil crop:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm neu-raised-card bg-[#EEF2F6] rounded-[28px] p-5 sm:p-6 border border-white/90 shadow-2xl relative animate-in zoom-in-95 duration-150 flex flex-col items-center select-none"
        onClick={e => e.stopPropagation()}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Header Modal */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-[#d4deeb]">
          <div>
            <h3 className="text-sm font-black text-[#0D162B]">{title}</h3>
            <p className="text-[10px] text-slate-500 font-semibold">
              Geser dan sesuaikan posisi wajah secara manual (1:1)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl neu-flat active:neu-pressed text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Petunjuk Penggunaan Manual */}
        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200/60">
          <Move className="w-3 h-3 stroke-[2.5]" />
          <span>Klik &amp; geser foto untuk mengatur posisi tengah</span>
        </div>

        {/* Kotak Potong Interaktif 1:1 (Crop Viewport) */}
        <div
          className="relative mt-3.5 rounded-2xl overflow-hidden bg-slate-900 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] cursor-grab active:cursor-grabbing touch-none border-2 border-blue-500/80"
          style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {/* Gambar yang diatur posisinya */}
          <div
            className="w-full h-full flex items-center justify-center origin-center transition-transform duration-75"
            style={{
              transform: `translate(${cropState.offsetX}px, ${cropState.offsetY}px) rotate(${cropState.rotation}deg) scale(${cropState.zoom})`,
            }}
          >
            <img
              src={imageSrc}
              alt="Foto untuk dipotong"
              className="max-w-none pointer-events-none select-none"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              draggable={false}
            />
          </div>

          {/* Grid Rule-of-Thirds (Bantuan Pemosisian) */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            <div className="border-r border-b border-white/20" />
            <div className="border-r border-b border-white/20" />
            <div className="border-b border-white/20" />
            <div className="border-r border-b border-white/20" />
            <div className="border-r border-b border-white/20" />
            <div className="border-b border-white/20" />
            <div className="border-r border-white/20" />
            <div className="border-r border-white/20" />
            <div />
          </div>

          {/* Overlay Lingkaran Avatar Mask (Menunjukkan area foto bundar) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"
          />

          {/* Badge Rasio 1:1 */}
          <div className="pointer-events-none absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[9px] font-mono font-black text-white">
            1 : 1
          </div>
        </div>

        {/* Kontrol Zoom Slider Manual */}
        <div className="w-full mt-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span className="flex items-center gap-1">
              <ZoomIn className="w-3.5 h-3.5 text-blue-600" />
              Perbesar / Zoom:
            </span>
            <span className="font-mono text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md text-[10px]">
              {cropState.zoom.toFixed(2)}x
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 rounded-xl neu-btn bg-[#EEF2F6] text-slate-700 hover:text-blue-700 cursor-pointer active:scale-95"
              title="Perkecil"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="1"
              max="3.5"
              step="0.05"
              value={cropState.zoom}
              onChange={handleZoomChange}
              className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-300 rounded-lg"
            />
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 rounded-xl neu-btn bg-[#EEF2F6] text-slate-700 hover:text-blue-700 cursor-pointer active:scale-95"
              title="Perbesar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tombol Aksi Tambahan: Rotasi 90° & Reset */}
        <div className="w-full mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleRotate}
            className="flex-1 py-1.5 px-2.5 rounded-xl neu-btn bg-[#EEF2F6] text-[11px] font-bold text-slate-700 hover:text-blue-700 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Putar 90°</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="py-1.5 px-3 rounded-xl neu-btn bg-[#EEF2F6] text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            title="Kembalikan posisi tengah"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Tombol Batal & Terapkan Potong */}
        <div className="w-full mt-5 grid grid-cols-2 gap-2.5 pt-3 border-t border-[#d4deeb]">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full py-2.5 rounded-xl neu-flat text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer active:scale-95 transition-all text-center"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirmCrop}
            disabled={isProcessing}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            {isProcessing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            )}
            <span>{isProcessing ? 'Memproses...' : 'Potong & Simpan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
