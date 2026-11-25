export const TEACHER_PORTRAIT_PRESETS = [
  { label: 'Foto Studio 1', url: '/src/assets/images/teacher_portrait_1_1795536394727.jpg' },
  { label: 'Foto Studio 2', url: '/src/assets/images/teacher_portrait_2_1795536394410.jpg' },
  { label: 'Foto Studio 3', url: '/src/assets/images/teacher_portrait_3_1795536395242.jpg' },
  { label: 'Foto Studio 4', url: '/src/assets/images/teacher_portrait_4_1795536395803.jpg' },
  { label: 'Foto Studio 5', url: '/src/assets/images/teacher_portrait_5_1795538515140.jpg' },
];

export async function resizeAvatarFile(file: File, maxSize = 400): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (JPG, PNG, atau WebP).');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file gambar maksimal 5 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak dapat diproses.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia untuk memproses foto.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
