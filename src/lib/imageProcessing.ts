// Padroniza fotos reais (catálogo, carrossel) pro formato que o Instagram
// aceita: JPEG, proporção 4:5 (dentro da faixa 4:5–1.91:1 aceita pela API),
// 1080×1350 — mesma proporção que a maioria dos templates do render-format já
// usa, pra foto real e card ficarem coerentes no mesmo carrossel. Recorte
// central (crop-to-fill), nunca distorce a imagem.
const TARGET_W = 1080
const TARGET_H = 1350

export function processImageTo4x5(file: File, quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const targetRatio = TARGET_W / TARGET_H
      const srcRatio = img.width / img.height
      let sx = 0, sy = 0, sw = img.width, sh = img.height
      if (srcRatio > targetRatio) {
        sw = img.height * targetRatio
        sx = (img.width - sw) / 2
      } else if (srcRatio < targetRatio) {
        sh = img.width / targetRatio
        sy = (img.height - sh) / 2
      }
      const canvas = document.createElement('canvas')
      canvas.width = TARGET_W
      canvas.height = TARGET_H
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas 2d context indisponível')); return }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H)
      canvas.toBlob(blob => { blob ? resolve(blob) : reject(new Error('falha ao gerar JPEG')) }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('falha ao carregar imagem')) }
    img.src = url
  })
}
