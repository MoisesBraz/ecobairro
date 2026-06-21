/**
 * Read a File as a base64 data URL.
 *
 * The backend stores `imagem_url` as a string column (TEXT in Postgres).
 * Until real object storage is wired up, we encode small images (≤ 5 MB
 * enforced by the form) inline as `data:image/...;base64,...` so they
 * round-trip via the existing API contract and render directly in <img>.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Falha ao ler ficheiro de imagem'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Erro de leitura'))
    reader.readAsDataURL(file)
  })
}
