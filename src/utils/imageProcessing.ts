/**
 * Utilitas pemrosesan citra di sisi browser (Client-Side HTML5 Canvas)
 * - Pembersihan latar belakang tanda tangan / paraf menjadi transparan (Auto Background Removal)
 * - Pemotongan foto profil manual 1:1 dengan resolusi optimal
 */

/**
 * Menghapus latar belakang kertas pada foto tanda tangan/paraf secara otomatis
 * dan mengonversinya menjadi PNG transparan dengan kontras tinta yang tajam.
 */
export async function removeSignatureBackground(
  imageSource: File | string,
  thresholdLight = 215,
  thresholdDark = 140
): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        // Batasi ukuran maksimal pemrosesan untuk menjaga performa cepat
        const maxDim = 1200;
        let targetW = width;
        let targetH = height;
        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
          } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetH = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          throw new Error('Gagal menginisialisasi context canvas 2D');
        }

        ctx.drawImage(img, 0, 0, targetW, targetH);
        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        const data = imgData.data;

        let minX = targetW;
        let minY = targetH;
        let maxX = 0;
        let maxY = 0;
        let hasInk = false;

        // Iterasi setiap piksel RGBA
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Hitung luminansi standar (tingkat kecerahan perseptual)
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          if (lum >= thresholdLight) {
            // Latar kertas putih/terang dijadikan 100% transparan
            data[i + 3] = 0;
          } else if (lum <= thresholdDark) {
            // Tinta gelap pekat dipertahankan solid
            data[i + 3] = 255;
            // Tingkatkan ketajaman tinta menjadi hitam/gelap pekat
            data[i] = Math.min(r, 20);
            data[i + 1] = Math.min(g, 25);
            data[i + 2] = Math.min(b, 40);

            const px = (i / 4) % targetW;
            const py = Math.floor(i / 4 / targetW);
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
            hasInk = true;
          } else {
            // Zona transisi / anti-aliasing halus agar garis tanda tangan tidak patah-patah
            const factor = (thresholdLight - lum) / (thresholdLight - thresholdDark);
            data[i + 3] = Math.round(factor * 255);
            data[i] = Math.min(r, 25);
            data[i + 1] = Math.min(g, 30);
            data[i + 2] = Math.min(b, 45);

            const px = (i / 4) % targetW;
            const py = Math.floor(i / 4 / targetW);
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
            hasInk = true;
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Jika ditemukan goresan tinta, pangkas ruang kosong (Auto Trim Bounding Box)
        let finalCanvas = canvas;
        if (hasInk && maxX > minX && maxY > minY) {
          const padding = 16;
          const cropX = Math.max(0, minX - padding);
          const cropY = Math.max(0, minY - padding);
          const cropW = Math.min(targetW - cropX, maxX - minX + padding * 2);
          const cropH = Math.min(targetH - cropY, maxY - minY + padding * 2);

          const trimmedCanvas = document.createElement('canvas');
          trimmedCanvas.width = cropW;
          trimmedCanvas.height = cropH;
          const trimmedCtx = trimmedCanvas.getContext('2d');
          if (trimmedCtx) {
            trimmedCtx.drawImage(
              canvas,
              cropX,
              cropY,
              cropW,
              cropH,
              0,
              0,
              cropW,
              cropH
            );
            finalCanvas = trimmedCanvas;
          }
        }

        const dataUrl = finalCanvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        resolve({ dataUrl, base64 });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Gagal memuat gambar tanda tangan.'));
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      const reader = new FileReader();
      reader.onload = e => {
        img.src = e.target?.result as string;
      };
      reader.onerror = e => reject(e);
      reader.readAsDataURL(imageSource);
    }
  });
}

export interface CropState {
  zoom: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Memotong gambar menjadi 1:1 persegi secara manual berdasarkan posisi offset, zoom, dan rotasi pengguna.
 */
export async function exportManualCroppedImage(
  imageSource: string,
  cropState: CropState,
  boxViewportSize: number,
  outputSize = 512
): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Gagal mendapatkan canvas 2D context');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, outputSize, outputSize);

        // Skala rasio viewport ke outputSize
        const scaleToOutput = outputSize / boxViewportSize;

        ctx.save();
        // Geser ke titik pusat canvas
        ctx.translate(outputSize / 2, outputSize / 2);

        // Terapkan translasi offset yang telah dikalikan faktor skala
        ctx.translate(
          cropState.offsetX * scaleToOutput,
          cropState.offsetY * scaleToOutput
        );

        // Terapkan rotasi manual
        ctx.rotate((cropState.rotation * Math.PI) / 180);

        // Hitung dimensi dasar gambar agar menutupi viewport (cover)
        const imgRatio = img.width / img.height;
        let baseDrawW = boxViewportSize;
        let baseDrawH = boxViewportSize;

        if (imgRatio >= 1) {
          // Gambar landscape
          baseDrawW = boxViewportSize * imgRatio;
          baseDrawH = boxViewportSize;
        } else {
          // Gambar portrait
          baseDrawW = boxViewportSize;
          baseDrawH = boxViewportSize / imgRatio;
        }

        // Terapkan zoom dan skala ke output
        const finalDrawW = baseDrawW * cropState.zoom * scaleToOutput;
        const finalDrawH = baseDrawH * cropState.zoom * scaleToOutput;

        ctx.drawImage(
          img,
          -finalDrawW / 2,
          -finalDrawH / 2,
          finalDrawW,
          finalDrawH
        );

        ctx.restore();

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64 = dataUrl.split(',')[1];
        resolve({ dataUrl, base64 });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Gagal memuat gambar untuk proses crop.'));
    img.src = imageSource;
  });
}
