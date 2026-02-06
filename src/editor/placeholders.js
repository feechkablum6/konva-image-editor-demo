export function createSampleImageDataUrl() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 640

  const context = canvas.getContext('2d')
  if (!context) {
    return ''
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#0f172a')
  gradient.addColorStop(1, '#155e75')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = 'rgba(255, 255, 255, 0.08)'
  context.beginPath()
  context.arc(220, 180, 130, 0, Math.PI * 2)
  context.fill()

  context.beginPath()
  context.arc(780, 360, 210, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#f8fafc'
  context.font = '700 58px Georgia'
  context.fillText('Sample Product', 72, 120)

  context.fillStyle = '#bae6fd'
  context.font = '400 30px Georgia'
  context.fillText('Upload your files and replace this image', 72, 180)

  context.fillStyle = '#14b8a6'
  context.fillRect(72, 240, 360, 220)

  context.fillStyle = '#0f172a'
  context.font = '700 34px Georgia'
  context.fillText('DEMO BLOCK', 102, 360)

  context.strokeStyle = '#67e8f9'
  context.lineWidth = 4
  context.strokeRect(56, 56, canvas.width - 112, canvas.height - 112)

  return canvas.toDataURL('image/png')
}

export function createDefaultBlockDataUrl() {
  const canvas = document.createElement('canvas')
  canvas.width = 860
  canvas.height = 520

  const context = canvas.getContext('2d')
  if (!context) {
    return ''
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#0f172a')
  gradient.addColorStop(1, '#155e75')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = 'rgba(255, 255, 255, 0.08)'
  context.beginPath()
  context.arc(660, 300, 170, 0, Math.PI * 2)
  context.fill()

  context.strokeStyle = '#67e8f9'
  context.lineWidth = 4
  context.strokeRect(42, 42, canvas.width - 84, canvas.height - 84)

  context.fillStyle = '#f8fafc'
  context.font = '700 56px Georgia'
  context.fillText('New Block', 86, 140)

  context.fillStyle = '#bae6fd'
  context.font = '400 30px Georgia'
  context.fillText('Replace with your image or edit this block', 86, 194)

  return canvas.toDataURL('image/png')
}
