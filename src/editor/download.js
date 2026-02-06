export function mimeToExtension(mimeType) {
  if (mimeType === 'image/jpeg') {
    return 'jpg'
  }
  if (mimeType === 'image/webp') {
    return 'webp'
  }
  return 'png'
}

export function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
