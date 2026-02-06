<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Konva from 'konva'

const MAX_UNDO_STEPS = 5
const MAX_HISTORY_STATES = MAX_UNDO_STEPS + 1
const IMAGE_FILTERS = [Konva.Filters.Brighten, Konva.Filters.Contrast, Konva.Filters.HSL]
const ZOOM_MIN = 0.35
const ZOOM_MAX = 3.5
const ZOOM_STEP = 1.08
const CANVAS_INSET = 20

const stageRef = ref(null)
const transformerRef = ref(null)
const canvasWrapRef = ref(null)
const imageInputRef = ref(null)
const importJsonInputRef = ref(null)
const cropPreviewRef = ref(null)

const stageSize = reactive({
  width: 960,
  height: 620,
})

const stageViewport = reactive({
  x: 0,
  y: 0,
  scale: 1,
})

const panMode = ref(false)

const blocks = ref([])
const lines = ref([])

const selectedId = ref('')
const tool = ref('select')
const isDrawing = ref(false)

const brushColor = ref('#0f766e')
const brushSize = ref(10)

const imageControls = reactive({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
})

const exportOptions = reactive({
  format: 'image/png',
  quality: 0.92,
  pixelRatio: 1,
  width: 960,
  height: 620,
})

const history = ref([])
const historyIndex = ref(-1)
const isRestoringHistory = ref(false)

const cropper = reactive({
  visible: false,
  mode: 'upload',
  targetId: '',
  queue: [],
  sourceName: '',
  sourceSrc: '',
  sourceWidth: 0,
  sourceHeight: 0,
  cropX: 0,
  cropY: 0,
  cropWidth: 0,
  cropHeight: 0,
  outputWidth: 0,
  outputHeight: 0,
  rotation: 0,
})

const cropSourceImage = ref(null)
const notice = ref('')
const imageCache = new Map()

let idCounter = 0
let noticeTimer = null

const selectedBlock = computed(() => {
  return blocks.value.find((item) => item.id === selectedId.value) || null
})

const selectedImage = computed(() => {
  if (!selectedBlock.value || selectedBlock.value.kind !== 'image') {
    return null
  }
  return selectedBlock.value
})

const selectedText = computed(() => {
  if (!selectedBlock.value || selectedBlock.value.kind !== 'text') {
    return null
  }
  return selectedBlock.value
})

const imageBlocks = computed(() => blocks.value.filter((item) => item.kind === 'image'))
const textBlocks = computed(() => blocks.value.filter((item) => item.kind === 'text'))
const totalBlocks = computed(() => blocks.value.length)
const selectedKindLabel = computed(() => (selectedBlock.value ? selectedBlock.value.kind : 'none'))
const historyCounter = computed(() => {
  const current = historyIndex.value >= 0 ? historyIndex.value + 1 : 0
  return `${current}/${history.value.length}`
})
const zoomPercent = computed(() => `${Math.round(stageViewport.scale * 100)}%`)

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1)

const stageConfig = computed(() => ({
  width: stageSize.width,
  height: stageSize.height,
  x: stageViewport.x,
  y: stageViewport.y,
  scaleX: stageViewport.scale,
  scaleY: stageViewport.scale,
  draggable: panMode.value,
}))

const stageBackgroundConfig = computed(() => ({
  x: 0,
  y: 0,
  width: stageSize.width,
  height: stageSize.height,
  listening: false,
  fillLinearGradientStartPoint: { x: 0, y: 0 },
  fillLinearGradientEndPoint: { x: stageSize.width, y: stageSize.height },
  fillLinearGradientColorStops: [0, '#d9f2ee', 1, '#f8fafc'],
}))

const transformerConfig = {
  rotateEnabled: true,
  keepRatio: false,
  enabledAnchors: [
    'top-left',
    'top-center',
    'top-right',
    'middle-right',
    'bottom-right',
    'bottom-center',
    'bottom-left',
    'middle-left',
  ],
  boundBoxFunc(oldBox, newBox) {
    if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) {
      return oldBox
    }
    return newBox
  },
}

function createId(prefix) {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toNumber(value, fallback = 0) {
  const next = Number(value)
  if (Number.isFinite(next)) {
    return next
  }
  return fallback
}

function setNotice(message) {
  notice.value = message
  if (noticeTimer) {
    window.clearTimeout(noticeTimer)
  }
  noticeTimer = window.setTimeout(() => {
    notice.value = ''
  }, 4200)
}

function getStageNode() {
  return stageRef.value?.getNode?.() || null
}

function updateStageSize() {
  if (!canvasWrapRef.value) {
    return
  }

  const width = Math.max(340, Math.floor(canvasWrapRef.value.clientWidth - CANVAS_INSET))
  const maxHeight = Math.max(320, Math.floor(window.innerHeight * 0.72))
  const preferredHeight = Math.round(width * 0.62)
  const height = clamp(preferredHeight, 320, maxHeight)

  stageSize.width = width
  stageSize.height = height
}

function syncExportSizeWithStage() {
  exportOptions.width = stageSize.width
  exportOptions.height = stageSize.height
}

function zoomBy(direction, anchor) {
  const oldScale = stageViewport.scale
  const newScaleRaw = direction > 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP
  const newScale = clamp(newScaleRaw, ZOOM_MIN, ZOOM_MAX)

  if (Math.abs(newScale - oldScale) < 0.000001) {
    return
  }

  const anchorPoint = anchor || {
    x: stageSize.width / 2,
    y: stageSize.height / 2,
  }

  const mousePointTo = {
    x: (anchorPoint.x - stageViewport.x) / oldScale,
    y: (anchorPoint.y - stageViewport.y) / oldScale,
  }

  stageViewport.scale = newScale
  stageViewport.x = anchorPoint.x - mousePointTo.x * newScale
  stageViewport.y = anchorPoint.y - mousePointTo.y * newScale
}

function zoomIn() {
  zoomBy(1)
}

function zoomOut() {
  zoomBy(-1)
}

function resetStageView() {
  stageViewport.x = 0
  stageViewport.y = 0
  stageViewport.scale = 1
}

function onStageWheel(event) {
  event.evt.preventDefault()

  const stage = getStageNode()
  const pointer = stage?.getPointerPosition()
  if (!pointer) {
    return
  }

  let direction = event.evt.deltaY > 0 ? -1 : 1
  if (event.evt.ctrlKey) {
    direction = -direction
  }

  zoomBy(direction, pointer)
}

function onStageDragEnd(event) {
  const stage = getStageNode()
  if (!stage || event.target !== stage) {
    return
  }

  stageViewport.x = event.target.x()
  stageViewport.y = event.target.y()
}

function setPanMode(nextState) {
  panMode.value = Boolean(nextState)
  if (panMode.value) {
    selectedId.value = ''
    nextTick(updateTransformer)
  }
}

function togglePanMode() {
  setPanMode(!panMode.value)
}

function focusSelectedBlock() {
  if (!selectedBlock.value) {
    return
  }

  const block = selectedBlock.value
  const centerX = block.x + block.scaleX * (block.width / 2)
  const centerY = block.y + block.scaleY * (block.height / 2)

  stageViewport.x = stageSize.width / 2 - centerX * stageViewport.scale
  stageViewport.y = stageSize.height / 2 - centerY * stageViewport.scale
}

function updateTransformer() {
  const transformer = transformerRef.value?.getNode?.()
  const stage = getStageNode()

  if (!transformer || !stage) {
    return
  }

  if (tool.value !== 'select' || panMode.value || !selectedId.value) {
    transformer.nodes([])
    transformer.getLayer()?.batchDraw()
    return
  }

  const selectedNode = stage.findOne(`#${selectedId.value}`)
  if (selectedNode) {
    transformer.nodes([selectedNode])
  } else {
    transformer.nodes([])
  }

  transformer.getLayer()?.batchDraw()
}

function setTool(nextTool) {
  tool.value = nextTool
  if (nextTool !== 'select') {
    setPanMode(false)
  }
  if (nextTool !== 'select') {
    selectedId.value = ''
  }
  nextTick(updateTransformer)
}

function selectBlock(id) {
  if (tool.value !== 'select' || panMode.value) {
    return
  }
  selectedId.value = id
  nextTick(updateTransformer)
}

function clonePoints(points) {
  return Array.isArray(points) ? [...points] : []
}

function serializeBlock(block) {
  if (block.kind === 'image') {
    return {
      kind: 'image',
      id: block.id,
      label: block.label,
      src: block.src,
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      rotation: block.rotation,
      scaleX: block.scaleX,
      scaleY: block.scaleY,
      brightness: block.brightness,
      contrast: block.contrast,
      saturation: block.saturation,
      hue: block.hue,
    }
  }

  return {
    kind: 'text',
    id: block.id,
    text: block.text,
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    rotation: block.rotation,
    scaleX: block.scaleX,
    scaleY: block.scaleY,
    fontSize: block.fontSize,
    fontFamily: block.fontFamily,
    fill: block.fill,
  }
}

function snapshotState() {
  return {
    blocks: blocks.value.map((block) => serializeBlock(block)),
    lines: lines.value.map((line) => ({
      id: line.id,
      tool: line.tool,
      color: line.color,
      size: line.size,
      points: clonePoints(line.points),
    })),
  }
}

async function getImageElement(src) {
  if (imageCache.has(src)) {
    return imageCache.get(src)
  }

  const image = await new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image loading failed'))
    img.src = src
  })

  imageCache.set(src, image)
  return image
}

async function hydrateBlock(rawBlock) {
  if (rawBlock.kind === 'image') {
    const image = await getImageElement(rawBlock.src)
    return {
      kind: 'image',
      id: rawBlock.id,
      label: rawBlock.label || 'Image',
      src: rawBlock.src,
      image,
      x: toNumber(rawBlock.x),
      y: toNumber(rawBlock.y),
      width: Math.max(20, Math.round(toNumber(rawBlock.width, image.naturalWidth || image.width))),
      height: Math.max(20, Math.round(toNumber(rawBlock.height, image.naturalHeight || image.height))),
      rotation: toNumber(rawBlock.rotation),
      scaleX: toNumber(rawBlock.scaleX, 1) || 1,
      scaleY: toNumber(rawBlock.scaleY, 1) || 1,
      brightness: toNumber(rawBlock.brightness),
      contrast: toNumber(rawBlock.contrast),
      saturation: toNumber(rawBlock.saturation),
      hue: toNumber(rawBlock.hue),
    }
  }

  return {
    kind: 'text',
    id: rawBlock.id,
    text: rawBlock.text || 'Demo text',
    x: toNumber(rawBlock.x),
    y: toNumber(rawBlock.y),
    width: Math.max(80, Math.round(toNumber(rawBlock.width, 240))),
    height: Math.max(40, Math.round(toNumber(rawBlock.height, 80))),
    rotation: toNumber(rawBlock.rotation),
    scaleX: toNumber(rawBlock.scaleX, 1) || 1,
    scaleY: toNumber(rawBlock.scaleY, 1) || 1,
    fontSize: Math.max(10, Math.round(toNumber(rawBlock.fontSize, 30))),
    fontFamily: rawBlock.fontFamily || 'Georgia',
    fill: rawBlock.fill || '#0f172a',
  }
}

async function applySnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.blocks) || !Array.isArray(snapshot.lines)) {
    throw new Error('Invalid snapshot format')
  }

  const hydratedBlocks = []
  for (const rawBlock of snapshot.blocks) {
    hydratedBlocks.push(await hydrateBlock(rawBlock))
  }

  blocks.value = hydratedBlocks
  lines.value = snapshot.lines.map((line) => ({
    id: line.id || createId('line'),
    tool: line.tool === 'erase' ? 'erase' : 'pen',
    color: line.color || '#0f766e',
    size: Math.max(1, Math.round(toNumber(line.size, 10))),
    points: clonePoints(line.points),
  }))

  selectedId.value = ''

  await nextTick()
  for (const block of blocks.value) {
    if (block.kind === 'image') {
      recacheImageNode(block.id)
    }
  }
  updateTransformer()
}

function pushHistory() {
  if (isRestoringHistory.value) {
    return
  }

  const nextSnapshot = snapshotState()
  const truncatedHistory = history.value.slice(0, historyIndex.value + 1)
  truncatedHistory.push(nextSnapshot)

  while (truncatedHistory.length > MAX_HISTORY_STATES) {
    truncatedHistory.shift()
  }

  history.value = truncatedHistory
  historyIndex.value = truncatedHistory.length - 1
}

async function restoreFromHistory(targetIndex) {
  if (targetIndex < 0 || targetIndex >= history.value.length) {
    return
  }

  const target = history.value[targetIndex]
  if (!target) {
    return
  }

  try {
    isRestoringHistory.value = true
    await applySnapshot(target)
    historyIndex.value = targetIndex
  } catch (error) {
    setNotice(`History restore failed: ${error.message}`)
  } finally {
    isRestoringHistory.value = false
  }
}

async function undo() {
  if (!canUndo.value) {
    return
  }
  await restoreFromHistory(historyIndex.value - 1)
}

async function redo() {
  if (!canRedo.value) {
    return
  }
  await restoreFromHistory(historyIndex.value + 1)
}

function recacheImageNode(id) {
  const stage = getStageNode()
  if (!stage) {
    return
  }

  const imageNode = stage.findOne(`#${id}`)
  if (!imageNode) {
    return
  }

  try {
    imageNode.clearCache()
    imageNode.cache()
    imageNode.getLayer()?.batchDraw()
  } catch {
    imageNode.getLayer()?.batchDraw()
  }
}

function getImageNodeConfig(block) {
  return {
    id: block.id,
    x: block.x,
    y: block.y,
    image: block.image,
    width: block.width,
    height: block.height,
    rotation: block.rotation,
    scaleX: block.scaleX,
    scaleY: block.scaleY,
    draggable: tool.value === 'select' && !panMode.value,
    filters: IMAGE_FILTERS,
    brightness: block.brightness,
    contrast: block.contrast,
    saturation: block.saturation,
    hue: block.hue,
    stroke: selectedId.value === block.id ? '#0f766e' : undefined,
    strokeWidth: selectedId.value === block.id ? 2 : 0,
  }
}

function getTextNodeConfig(block) {
  return {
    id: block.id,
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    rotation: block.rotation,
    scaleX: block.scaleX,
    scaleY: block.scaleY,
    draggable: tool.value === 'select' && !panMode.value,
    text: block.text,
    fontSize: block.fontSize,
    fontFamily: block.fontFamily,
    fill: block.fill,
    align: 'left',
    verticalAlign: 'top',
  }
}

function getLineNodeConfig(line) {
  return {
    id: line.id,
    points: line.points,
    stroke: line.color,
    strokeWidth: line.size,
    tension: 0.25,
    lineCap: 'round',
    lineJoin: 'round',
    listening: false,
    globalCompositeOperation: line.tool === 'erase' ? 'destination-out' : 'source-over',
  }
}

function onStageMouseDown(event) {
  const stage = event.target.getStage()
  if (!stage) {
    return
  }

  if (panMode.value) {
    return
  }

  if (tool.value !== 'select') {
    const pointer = stage.getPointerPosition()
    if (!pointer) {
      return
    }

    isDrawing.value = true
    lines.value.push({
      id: createId('line'),
      tool: tool.value,
      color: brushColor.value,
      size: brushSize.value,
      points: [pointer.x, pointer.y],
    })
    return
  }

  if (event.target === stage) {
    selectedId.value = ''
    nextTick(updateTransformer)
  }
}

function onStageMouseMove(event) {
  if (panMode.value) {
    return
  }

  if (!isDrawing.value) {
    return
  }

  const stage = event.target.getStage()
  const pointer = stage?.getPointerPosition()
  if (!pointer || lines.value.length === 0) {
    return
  }

  const lastLineIndex = lines.value.length - 1
  const lastLine = lines.value[lastLineIndex]
  const updatedPoints = [...lastLine.points, pointer.x, pointer.y]

  lines.value.splice(lastLineIndex, 1, {
    ...lastLine,
    points: updatedPoints,
  })
}

function onStageMouseUp() {
  if (panMode.value) {
    return
  }

  if (!isDrawing.value) {
    return
  }
  isDrawing.value = false
  pushHistory()
}

function onBlockDragEnd(block, event) {
  block.x = event.target.x()
  block.y = event.target.y()
  pushHistory()
}

function onBlockTransformEnd(block, event) {
  const node = event.target
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()

  const signX = scaleX < 0 ? -1 : 1
  const signY = scaleY < 0 ? -1 : 1

  block.x = node.x()
  block.y = node.y()
  block.rotation = node.rotation()
  block.width = Math.max(20, Math.round(node.width() * Math.abs(scaleX)))
  block.height = Math.max(20, Math.round(node.height() * Math.abs(scaleY)))
  block.scaleX = signX
  block.scaleY = signY

  node.scaleX(signX)
  node.scaleY(signY)

  if (block.kind === 'text') {
    block.fontSize = Math.max(10, Math.round(block.fontSize * Math.abs(scaleY)))
  }

  if (block.kind === 'image') {
    nextTick(() => recacheImageNode(block.id))
  }

  pushHistory()
}

function syncImageControls() {
  if (!selectedImage.value) {
    imageControls.brightness = 0
    imageControls.contrast = 0
    imageControls.saturation = 0
    imageControls.hue = 0
    return
  }

  imageControls.brightness = selectedImage.value.brightness
  imageControls.contrast = selectedImage.value.contrast
  imageControls.saturation = selectedImage.value.saturation
  imageControls.hue = selectedImage.value.hue
}

function onImageControlInput(key, value) {
  if (!selectedImage.value) {
    return
  }

  const numericValue = toNumber(value)
  imageControls[key] = numericValue
  selectedImage.value[key] = numericValue

  nextTick(() => recacheImageNode(selectedImage.value.id))
}

function commitImageControlChange() {
  if (!selectedImage.value) {
    return
  }
  pushHistory()
}

function flipSelectedImage(axis) {
  if (!selectedImage.value) {
    return
  }

  const block = selectedImage.value

  if (axis === 'x') {
    const previousSign = block.scaleX < 0 ? -1 : 1
    block.x += previousSign * block.width
    block.scaleX *= -1
  } else {
    const previousSign = block.scaleY < 0 ? -1 : 1
    block.y += previousSign * block.height
    block.scaleY *= -1
  }

  pushHistory()
  nextTick(updateTransformer)
}

function addTextBlock() {
  const block = {
    kind: 'text',
    id: createId('txt'),
    text: 'Demo text',
    x: 48,
    y: 48,
    width: 240,
    height: 84,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fontSize: 30,
    fontFamily: 'Georgia',
    fill: '#0f172a',
  }

  blocks.value.push(block)
  selectedId.value = block.id
  pushHistory()
  nextTick(updateTransformer)
}

function removeSelectedBlock() {
  if (!selectedBlock.value) {
    return
  }

  blocks.value = blocks.value.filter((item) => item.id !== selectedBlock.value.id)
  selectedId.value = ''
  pushHistory()
  nextTick(updateTransformer)
}

function updateTextContent(value) {
  if (!selectedText.value) {
    return
  }
  selectedText.value.text = value
}

function updateTextColor(value) {
  if (!selectedText.value) {
    return
  }
  selectedText.value.fill = value
}

function updateTextSize(value) {
  if (!selectedText.value) {
    return
  }
  selectedText.value.fontSize = Math.max(10, Math.round(toNumber(value, 24)))
}

function commitTextChange() {
  if (!selectedText.value) {
    return
  }
  pushHistory()
}

function triggerImagePicker() {
  imageInputRef.value?.click()
}

function createSampleImageDataUrl() {
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

async function addSampleImageBlock() {
  try {
    const sampleSrc = createSampleImageDataUrl()
    if (!sampleSrc) {
      setNotice('Sample image generation failed.')
      return
    }

    await addImageBlockFromSrc(sampleSrc, 'sample-demo.png')
  } catch (error) {
    setNotice(`Sample add failed: ${error.message}`)
  }
}

function triggerImportStatePicker() {
  importJsonInputRef.value?.click()
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new window.FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`Could not read file: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

async function onImageInputChange(event) {
  const target = event.target
  const files = Array.from(target.files || [])
  target.value = ''

  if (files.length === 0) {
    return
  }

  const supportedFiles = files.filter((file) => file.type.startsWith('image/'))
  if (supportedFiles.length === 0) {
    setNotice('No supported image files selected.')
    return
  }

  try {
    for (const file of supportedFiles) {
      const src = await readFileAsDataUrl(file)
      cropper.queue.push({
        name: file.name,
        src,
      })
    }

    if (!cropper.visible) {
      await openNextCropperFromQueue()
    }
  } catch (error) {
    setNotice(error.message)
  }
}

async function addImageBlockFromSrc(src, label = 'Image') {
  const image = await getImageElement(src)

  const maxStartWidth = 360
  const sourceWidth = image.naturalWidth || image.width || 1
  const sourceHeight = image.naturalHeight || image.height || 1
  const startScale = Math.min(1, maxStartWidth / sourceWidth)

  const block = {
    kind: 'image',
    id: createId('img'),
    label,
    src,
    image,
    x: 36 + (blocks.value.length % 6) * 16,
    y: 36 + (blocks.value.length % 6) * 16,
    width: Math.max(20, Math.round(sourceWidth * startScale)),
    height: Math.max(20, Math.round(sourceHeight * startScale)),
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
  }

  blocks.value.push(block)
  selectedId.value = block.id

  await nextTick()
  recacheImageNode(block.id)
  syncImageControls()
  pushHistory()
  updateTransformer()
}

async function openCropper(src, name, mode = 'upload', targetId = '') {
  cropper.mode = mode
  cropper.targetId = targetId
  cropper.sourceSrc = src
  cropper.sourceName = name || 'image'
  cropper.visible = true

  const image = await getImageElement(src)
  cropSourceImage.value = image

  cropper.sourceWidth = image.naturalWidth || image.width
  cropper.sourceHeight = image.naturalHeight || image.height

  cropper.cropX = 0
  cropper.cropY = 0
  cropper.cropWidth = cropper.sourceWidth
  cropper.cropHeight = cropper.sourceHeight
  cropper.outputWidth = cropper.sourceWidth
  cropper.outputHeight = cropper.sourceHeight
  cropper.rotation = 0

  await nextTick()
  renderCropPreview()
}

async function openNextCropperFromQueue() {
  const nextEntry = cropper.queue.shift()
  if (!nextEntry) {
    closeCropper(true)
    return
  }
  await openCropper(nextEntry.src, nextEntry.name, 'upload', '')
}

async function openCropperForSelectedImage() {
  if (!selectedImage.value) {
    return
  }

  cropper.queue = []
  await openCropper(selectedImage.value.src, selectedImage.value.label, 'edit', selectedImage.value.id)
}

function normalizeCropValues() {
  if (!cropSourceImage.value) {
    return
  }

  const sourceWidth = Math.max(1, Math.round(toNumber(cropper.sourceWidth, 1)))
  const sourceHeight = Math.max(1, Math.round(toNumber(cropper.sourceHeight, 1)))

  cropper.cropX = clamp(Math.round(toNumber(cropper.cropX)), 0, Math.max(0, sourceWidth - 1))
  cropper.cropY = clamp(Math.round(toNumber(cropper.cropY)), 0, Math.max(0, sourceHeight - 1))

  cropper.cropWidth = clamp(
    Math.round(toNumber(cropper.cropWidth, sourceWidth)),
    1,
    Math.max(1, sourceWidth - cropper.cropX),
  )
  cropper.cropHeight = clamp(
    Math.round(toNumber(cropper.cropHeight, sourceHeight)),
    1,
    Math.max(1, sourceHeight - cropper.cropY),
  )

  cropper.outputWidth = clamp(Math.round(toNumber(cropper.outputWidth, cropper.cropWidth)), 1, 4096)
  cropper.outputHeight = clamp(Math.round(toNumber(cropper.outputHeight, cropper.cropHeight)), 1, 4096)
  cropper.rotation = clamp(toNumber(cropper.rotation), -180, 180)
}

function setCropFullImage() {
  if (!cropSourceImage.value) {
    return
  }

  cropper.cropX = 0
  cropper.cropY = 0
  cropper.cropWidth = cropper.sourceWidth
  cropper.cropHeight = cropper.sourceHeight
  cropper.outputWidth = cropper.sourceWidth
  cropper.outputHeight = cropper.sourceHeight
  cropper.rotation = 0

  renderCropPreview()
}

function setCropSquareCenter() {
  if (!cropSourceImage.value) {
    return
  }

  const side = Math.min(cropper.sourceWidth, cropper.sourceHeight)
  cropper.cropX = Math.floor((cropper.sourceWidth - side) / 2)
  cropper.cropY = Math.floor((cropper.sourceHeight - side) / 2)
  cropper.cropWidth = side
  cropper.cropHeight = side
  cropper.outputWidth = side
  cropper.outputHeight = side

  renderCropPreview()
}

function renderCropPreview() {
  const canvas = cropPreviewRef.value
  if (!canvas || !cropSourceImage.value) {
    return
  }

  normalizeCropValues()

  const targetAspect = cropper.outputWidth / cropper.outputHeight
  const maxPreviewSize = 420

  let previewWidth = maxPreviewSize
  let previewHeight = maxPreviewSize
  if (targetAspect >= 1) {
    previewHeight = Math.max(80, Math.round(maxPreviewSize / targetAspect))
  } else {
    previewWidth = Math.max(80, Math.round(maxPreviewSize * targetAspect))
  }

  canvas.width = previewWidth
  canvas.height = previewHeight

  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  context.clearRect(0, 0, previewWidth, previewHeight)
  context.fillStyle = '#0f172a'
  context.fillRect(0, 0, previewWidth, previewHeight)

  context.save()
  context.translate(previewWidth / 2, previewHeight / 2)
  context.rotate((cropper.rotation * Math.PI) / 180)
  context.drawImage(
    cropSourceImage.value,
    cropper.cropX,
    cropper.cropY,
    cropper.cropWidth,
    cropper.cropHeight,
    -previewWidth / 2,
    -previewHeight / 2,
    previewWidth,
    previewHeight,
  )
  context.restore()
}

function buildCroppedDataUrl() {
  normalizeCropValues()

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = cropper.outputWidth
  outputCanvas.height = cropper.outputHeight

  const context = outputCanvas.getContext('2d')
  if (!context || !cropSourceImage.value) {
    throw new Error('Cropper canvas is unavailable')
  }

  context.clearRect(0, 0, outputCanvas.width, outputCanvas.height)
  context.save()
  context.translate(outputCanvas.width / 2, outputCanvas.height / 2)
  context.rotate((cropper.rotation * Math.PI) / 180)
  context.drawImage(
    cropSourceImage.value,
    cropper.cropX,
    cropper.cropY,
    cropper.cropWidth,
    cropper.cropHeight,
    -outputCanvas.width / 2,
    -outputCanvas.height / 2,
    outputCanvas.width,
    outputCanvas.height,
  )
  context.restore()

  return outputCanvas.toDataURL('image/png', 1)
}

function closeCropper(clearQueue = false) {
  cropper.visible = false
  cropper.mode = 'upload'
  cropper.targetId = ''
  cropper.sourceName = ''
  cropper.sourceSrc = ''
  cropper.sourceWidth = 0
  cropper.sourceHeight = 0
  cropper.cropX = 0
  cropper.cropY = 0
  cropper.cropWidth = 0
  cropper.cropHeight = 0
  cropper.outputWidth = 0
  cropper.outputHeight = 0
  cropper.rotation = 0
  cropSourceImage.value = null

  if (clearQueue) {
    cropper.queue = []
  }
}

async function applyCropper() {
  if (!cropSourceImage.value) {
    return
  }

  try {
    const dataUrl = buildCroppedDataUrl()

    if (cropper.mode === 'upload') {
      const name = cropper.sourceName || 'Image'
      await addImageBlockFromSrc(dataUrl, name)

      if (cropper.queue.length > 0) {
        await openNextCropperFromQueue()
        return
      }

      closeCropper(true)
      return
    }

    const target = blocks.value.find((item) => item.id === cropper.targetId && item.kind === 'image')
    if (!target) {
      closeCropper(true)
      return
    }

    const image = await getImageElement(dataUrl)
    target.src = dataUrl
    target.image = image
    target.width = cropper.outputWidth
    target.height = cropper.outputHeight

    await nextTick()
    recacheImageNode(target.id)
    pushHistory()
    closeCropper(true)
  } catch (error) {
    setNotice(`Crop failed: ${error.message}`)
  }
}

async function pickColorWithEyedropper() {
  if (!window.EyeDropper) {
    setNotice('EyeDropper API is not available in this browser.')
    return
  }

  try {
    const picker = new window.EyeDropper()
    const result = await picker.open()
    brushColor.value = result.sRGBHex

    if (selectedText.value) {
      selectedText.value.fill = result.sRGBHex
      pushHistory()
    }
  } catch {
    setNotice('Color picking cancelled.')
  }
}

function mimeToExtension(mimeType) {
  if (mimeType === 'image/jpeg') {
    return 'jpg'
  }
  if (mimeType === 'image/webp') {
    return 'webp'
  }
  return 'png'
}

function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

async function exportImage() {
  const stage = getStageNode()
  if (!stage) {
    return
  }

  try {
    const mimeType = exportOptions.format
    const quality = clamp(toNumber(exportOptions.quality, 0.92), 0.1, 1)
    const pixelRatio = Math.max(1, toNumber(exportOptions.pixelRatio, 1))

    let dataUrl = stage.toDataURL({
      mimeType,
      quality,
      pixelRatio,
    })

    const targetWidth = Math.max(1, Math.round(toNumber(exportOptions.width, stageSize.width)))
    const targetHeight = Math.max(1, Math.round(toNumber(exportOptions.height, stageSize.height)))

    if (targetWidth !== Math.round(stageSize.width * pixelRatio) || targetHeight !== Math.round(stageSize.height * pixelRatio)) {
      const exportImageElement = await getImageElement(dataUrl)
      const resizeCanvas = document.createElement('canvas')
      resizeCanvas.width = targetWidth
      resizeCanvas.height = targetHeight

      const resizeContext = resizeCanvas.getContext('2d')
      if (resizeContext) {
        resizeContext.drawImage(exportImageElement, 0, 0, targetWidth, targetHeight)
        dataUrl = resizeCanvas.toDataURL(mimeType, quality)
      }
    }

    const extension = mimeToExtension(mimeType)
    downloadDataUrl(dataUrl, `konva-editor-export-${Date.now()}.${extension}`)
  } catch (error) {
    setNotice(`Export failed: ${error.message}`)
  }
}

function exportStateJson() {
  try {
    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      snapshot: snapshotState(),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })

    downloadBlob(blob, `konva-editor-state-${Date.now()}.json`)
  } catch (error) {
    setNotice(`State export failed: ${error.message}`)
  }
}

async function onImportStateChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''

  if (!file) {
    return
  }

  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    const snapshot = parsed.snapshot || parsed

    await applySnapshot(snapshot)
    pushHistory()
    setNotice('State imported successfully.')
  } catch (error) {
    setNotice(`State import failed: ${error.message}`)
  }
}

watch(selectedImage, () => {
  syncImageControls()
})

watch(
  () => selectedId.value,
  () => {
    nextTick(updateTransformer)
  },
)

watch(
  () => tool.value,
  () => {
    nextTick(updateTransformer)
  },
)

onMounted(() => {
  updateStageSize()
  resetStageView()
  syncExportSizeWithStage()
  window.addEventListener('resize', updateStageSize)
  pushHistory()
  addSampleImageBlock()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateStageSize)
  if (noticeTimer) {
    window.clearTimeout(noticeTimer)
  }
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="title-wrap">
        <h1>Konva Image Editor Demo</h1>
        <p>MVP: upload, crop/resize/rotate, filters, draw/erase, text, eyedropper, undo/redo(5), export.</p>
        <div class="status-row">
          <span class="status-pill">Tool: {{ tool }}</span>
          <span class="status-pill">Pan: {{ panMode ? 'on' : 'off' }}</span>
          <span class="status-pill">Zoom: {{ zoomPercent }}</span>
          <span class="status-pill">Selected: {{ selectedKindLabel }}</span>
          <span class="status-pill">Images: {{ imageBlocks.length }}</span>
          <span class="status-pill">Texts: {{ textBlocks.length }}</span>
          <span class="status-pill">Blocks: {{ totalBlocks }}</span>
          <span class="status-pill">History: {{ historyCounter }}</span>
        </div>
      </div>
      <div class="top-actions">
        <button class="btn-primary" @click="triggerImagePicker">Upload image(s)</button>
        <button class="btn-soft" @click="addSampleImageBlock">Add sample</button>
        <button class="btn-soft" :class="{ active: panMode }" @click="togglePanMode">Pan mode</button>
        <button class="btn-soft" @click="zoomOut">Zoom -</button>
        <button class="btn-soft" @click="zoomIn">Zoom +</button>
        <button class="btn-soft" @click="resetStageView">Reset view</button>
        <button class="btn-soft" :disabled="!selectedBlock" @click="focusSelectedBlock">Center selected</button>
        <button class="btn-soft" :disabled="!selectedImage" @click="openCropperForSelectedImage">Crop selected</button>
        <button class="btn-soft" @click="addTextBlock">Add text</button>
        <button class="btn-danger" :disabled="!selectedBlock" @click="removeSelectedBlock">Delete selected</button>
        <button class="btn-soft" :disabled="!canUndo" @click="undo">Undo</button>
        <button class="btn-soft" :disabled="!canRedo" @click="redo">Redo</button>
      </div>
    </header>

    <div class="workspace">
      <aside class="panel">
        <section>
          <h2>Tools</h2>
          <div class="tool-row">
            <button :class="{ active: tool === 'select' }" @click="setTool('select')">Select</button>
            <button :class="{ active: tool === 'pen' }" @click="setTool('pen')">Brush</button>
            <button :class="{ active: tool === 'erase' }" @click="setTool('erase')">Eraser</button>
          </div>

          <div class="field-grid">
            <label>
              Brush color
              <input v-model="brushColor" type="color" />
            </label>
            <label>
              Brush size
              <input v-model.number="brushSize" type="range" min="1" max="50" step="1" />
              <span>{{ brushSize }} px</span>
            </label>
            <button @click="pickColorWithEyedropper">Pick color (Eyedropper)</button>
          </div>
        </section>

        <section>
          <h2>Selected image</h2>

          <template v-if="selectedImage">
            <div class="field-grid">
              <label>
                Brightness
                <input
                  :value="imageControls.brightness"
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  @input="onImageControlInput('brightness', $event.target.value)"
                  @change="commitImageControlChange"
                />
                <span>{{ imageControls.brightness.toFixed(2) }}</span>
              </label>

              <label>
                Contrast
                <input
                  :value="imageControls.contrast"
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  @input="onImageControlInput('contrast', $event.target.value)"
                  @change="commitImageControlChange"
                />
                <span>{{ Math.round(imageControls.contrast) }}</span>
              </label>

              <label>
                Saturation
                <input
                  :value="imageControls.saturation"
                  type="range"
                  min="-2"
                  max="2"
                  step="0.01"
                  @input="onImageControlInput('saturation', $event.target.value)"
                  @change="commitImageControlChange"
                />
                <span>{{ imageControls.saturation.toFixed(2) }}</span>
              </label>

              <label>
                Hue (WB demo)
                <input
                  :value="imageControls.hue"
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  @input="onImageControlInput('hue', $event.target.value)"
                  @change="commitImageControlChange"
                />
                <span>{{ Math.round(imageControls.hue) }} deg</span>
              </label>

              <div class="tool-row">
                <button @click="flipSelectedImage('x')">Flip X</button>
                <button @click="flipSelectedImage('y')">Flip Y</button>
              </div>
            </div>
          </template>

          <p v-else class="muted">Select an image block to edit filters and flip.</p>
        </section>

        <section>
          <h2>Selected text</h2>

          <template v-if="selectedText">
            <div class="field-grid">
              <label>
                Text
                <textarea
                  :value="selectedText.text"
                  rows="3"
                  @input="updateTextContent($event.target.value)"
                  @change="commitTextChange"
                  @blur="commitTextChange"
                />
              </label>

              <label>
                Size
                <input
                  :value="selectedText.fontSize"
                  type="range"
                  min="10"
                  max="160"
                  step="1"
                  @input="updateTextSize($event.target.value)"
                  @change="commitTextChange"
                />
                <span>{{ selectedText.fontSize }} px</span>
              </label>

              <label>
                Color
                <input
                  :value="selectedText.fill"
                  type="color"
                  @input="updateTextColor($event.target.value)"
                  @change="commitTextChange"
                />
              </label>
            </div>
          </template>

          <p v-else class="muted">Select a text block to edit content and style.</p>
        </section>

        <section>
          <h2>Export / Import</h2>

          <div class="field-grid">
            <label>
              Format
              <select v-model="exportOptions.format">
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </label>

            <label>
              Quality
              <input v-model.number="exportOptions.quality" type="range" min="0.1" max="1" step="0.01" />
              <span>{{ exportOptions.quality.toFixed(2) }}</span>
            </label>

            <label>
              Pixel ratio
              <input v-model.number="exportOptions.pixelRatio" type="range" min="1" max="3" step="0.1" />
              <span>{{ exportOptions.pixelRatio.toFixed(1) }}x</span>
            </label>

            <label>
              Width
              <input v-model.number="exportOptions.width" type="number" min="1" max="6000" />
            </label>

            <label>
              Height
              <input v-model.number="exportOptions.height" type="number" min="1" max="6000" />
            </label>

            <div class="tool-row">
              <button @click="syncExportSizeWithStage">Use stage size</button>
              <button @click="exportImage">Export image</button>
            </div>

            <div class="tool-row">
              <button @click="exportStateJson">Export state JSON</button>
              <button @click="triggerImportStatePicker">Import state JSON</button>
            </div>
          </div>
        </section>
      </aside>

      <div ref="canvasWrapRef" class="canvas-wrap">
        <v-stage
          ref="stageRef"
          :config="stageConfig"
          @mousedown="onStageMouseDown"
          @mousemove="onStageMouseMove"
          @mouseup="onStageMouseUp"
          @touchstart="onStageMouseDown"
          @touchmove="onStageMouseMove"
          @touchend="onStageMouseUp"
          @wheel="onStageWheel"
          @dragend="onStageDragEnd"
        >
          <v-layer>
            <v-rect :config="stageBackgroundConfig" />

            <v-image
              v-for="block in imageBlocks"
              :key="block.id"
              :config="getImageNodeConfig(block)"
              @click="selectBlock(block.id)"
              @tap="selectBlock(block.id)"
              @dragend="onBlockDragEnd(block, $event)"
              @transformend="onBlockTransformEnd(block, $event)"
            />

            <v-text
              v-for="block in textBlocks"
              :key="block.id"
              :config="getTextNodeConfig(block)"
              @click="selectBlock(block.id)"
              @tap="selectBlock(block.id)"
              @dragend="onBlockDragEnd(block, $event)"
              @transformend="onBlockTransformEnd(block, $event)"
            />

            <v-transformer ref="transformerRef" :config="transformerConfig" />
          </v-layer>

          <v-layer :config="{ listening: false }">
            <v-line
              v-for="line in lines"
              :key="line.id"
              :config="getLineNodeConfig(line)"
            />
          </v-layer>
        </v-stage>

        <p class="canvas-hint">
          Wheel = zoom, Pan mode = move viewport, Reset view = return to origin. Select mode edits blocks.
        </p>
      </div>
    </div>

    <input
      ref="imageInputRef"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="onImageInputChange"
    />

    <input
      ref="importJsonInputRef"
      type="file"
      accept="application/json,.json"
      class="hidden"
      @change="onImportStateChange"
    />

    <div v-if="cropper.visible" class="cropper-overlay" @click.self="closeCropper(true)">
      <div class="cropper-modal">
        <div class="cropper-header">
          <h2>Cropper (upload/edit)</h2>
          <button @click="closeCropper(true)">Close</button>
        </div>

        <div class="cropper-content">
          <div class="crop-preview-wrap">
            <canvas ref="cropPreviewRef" class="crop-preview" />
            <p>
              Source: {{ cropper.sourceWidth }}x{{ cropper.sourceHeight }} | Output: {{ cropper.outputWidth }}x{{ cropper.outputHeight }}
            </p>
          </div>

          <div class="crop-fields">
            <label>
              Crop X
              <input v-model.number="cropper.cropX" type="number" min="0" @input="renderCropPreview" />
            </label>
            <label>
              Crop Y
              <input v-model.number="cropper.cropY" type="number" min="0" @input="renderCropPreview" />
            </label>
            <label>
              Crop Width
              <input v-model.number="cropper.cropWidth" type="number" min="1" @input="renderCropPreview" />
            </label>
            <label>
              Crop Height
              <input v-model.number="cropper.cropHeight" type="number" min="1" @input="renderCropPreview" />
            </label>
            <label>
              Output Width
              <input v-model.number="cropper.outputWidth" type="number" min="1" max="4096" @input="renderCropPreview" />
            </label>
            <label>
              Output Height
              <input v-model.number="cropper.outputHeight" type="number" min="1" max="4096" @input="renderCropPreview" />
            </label>
            <label>
              Rotation
              <input v-model.number="cropper.rotation" type="range" min="-180" max="180" step="1" @input="renderCropPreview" />
              <span>{{ Math.round(cropper.rotation) }} deg</span>
            </label>

            <div class="tool-row">
              <button @click="setCropFullImage">Full image</button>
              <button @click="setCropSquareCenter">Centered square</button>
            </div>

            <div class="tool-row">
              <button @click="applyCropper">Apply crop</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p v-if="notice" class="notice">{{ notice }}</p>
  </div>
</template>

<style scoped>
.app-shell {
  --c-ink: #0f172a;
  --c-subtle: #334155;
  --c-panel: #f8fafc;
  --c-line: rgba(15, 23, 42, 0.14);
  --c-accent: #0f766e;
  --c-accent-soft: #ccfbf1;
  --radius-l: 16px;
  --radius-m: 12px;
  --shadow-1: 0 10px 28px rgba(15, 23, 42, 0.08);
  --shadow-2: 0 2px 10px rgba(15, 23, 42, 0.08);
  min-height: 100vh;
  color: var(--c-ink);
  background:
    radial-gradient(circle at 0% 0%, rgba(13, 148, 136, 0.18), transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(2, 132, 199, 0.16), transparent 30%),
    radial-gradient(circle at 80% 100%, rgba(217, 119, 6, 0.16), transparent 34%),
    linear-gradient(165deg, #f0fdfa, #f8fafc 42%, #eff6ff);
  font-family: 'Manrope', 'Trebuchet MS', 'Segoe UI', sans-serif;
  padding: 16px;
}

.topbar {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(280px, 0.8fr);
  gap: 14px;
  margin-bottom: 14px;
  align-items: start;
}

.title-wrap {
  border-radius: var(--radius-l);
  border: 1px solid var(--c-line);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.96), rgba(241, 245, 249, 0.85));
  box-shadow: var(--shadow-1);
  padding: 14px 16px;
}

.title-wrap h1 {
  margin: 0;
  font-size: clamp(1.24rem, 2.1vw, 1.9rem);
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.title-wrap p {
  margin: 6px 0 0;
  color: var(--c-subtle);
  font-size: 0.9rem;
  max-width: 860px;
}

.status-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.status-pill {
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(226, 232, 240, 0.88));
  color: #0b3b36;
  border-radius: 999px;
  font-size: 0.75rem;
  padding: 5px 10px;
  white-space: nowrap;
}

.top-actions {
  border-radius: var(--radius-l);
  border: 1px solid var(--c-line);
  background: linear-gradient(160deg, rgba(248, 250, 252, 0.96), rgba(226, 232, 240, 0.88));
  box-shadow: var(--shadow-2);
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(292px, 360px) 1fr;
  gap: 14px;
  align-items: start;
}

.panel {
  position: sticky;
  top: 12px;
  max-height: calc(100vh - 28px);
  overflow: auto;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.88));
  border: 1px solid var(--c-line);
  border-radius: var(--radius-l);
  box-shadow: var(--shadow-1);
  padding: 12px;
  display: grid;
  gap: 12px;
}

.panel::-webkit-scrollbar {
  width: 10px;
}

.panel::-webkit-scrollbar-thumb {
  background: rgba(15, 118, 110, 0.25);
  border-radius: 999px;
}

.panel section {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: var(--radius-m);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(241, 245, 249, 0.9));
  padding: 10px;
}

.panel h2 {
  margin: 0 0 8px;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--c-accent);
}

.field-grid {
  display: grid;
  gap: 8px;
}

.field-grid label {
  display: grid;
  gap: 4px;
  font-size: 0.82rem;
  color: #0b1324;
}

.field-grid label span {
  color: #475569;
  font-size: 0.77rem;
}

.tool-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.canvas-wrap {
  position: relative;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.9), rgba(226, 232, 240, 0.68));
  border: 1px solid var(--c-line);
  border-radius: var(--radius-l);
  padding: 10px;
  box-shadow: var(--shadow-1);
  overflow: hidden;
}

.canvas-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: var(--radius-l);
  border: 1px solid rgba(15, 118, 110, 0.2);
}

.canvas-hint {
  margin: 8px 2px 0;
  color: #1f2937;
  font-size: 0.8rem;
}

button,
select,
input,
textarea {
  font: inherit;
}

button {
  border: 1px solid rgba(15, 23, 42, 0.18);
  background: linear-gradient(170deg, #f8fafc, #e2e8f0);
  color: #0f172a;
  border-radius: 10px;
  padding: 7px 11px;
  cursor: pointer;
  transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
  font-weight: 600;
  letter-spacing: 0.01em;
}

button:hover:enabled {
  transform: translateY(-1px);
  border-color: rgba(14, 116, 144, 0.5);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

button:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid rgba(14, 116, 144, 0.5);
  outline-offset: 1px;
}

button.active {
  border-color: #0f766e;
  background: linear-gradient(160deg, var(--c-accent-soft), #99f6e4);
  box-shadow: 0 4px 14px rgba(15, 118, 110, 0.22);
}

.btn-primary {
  background: linear-gradient(160deg, #0f766e, #0e7490);
  color: #f8fafc;
  border-color: rgba(15, 118, 110, 0.4);
}

.btn-primary:hover:enabled {
  border-color: rgba(2, 132, 199, 0.45);
}

.btn-danger {
  background: linear-gradient(160deg, #ef4444, #dc2626);
  color: #fff;
  border-color: rgba(220, 38, 38, 0.35);
}

.btn-soft {
  background: linear-gradient(160deg, #f8fafc, #e2e8f0);
}

input,
select,
textarea {
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 9px;
  background: #ffffff;
  color: var(--c-ink);
  padding: 7px 8px;
}

input[type='range'] {
  width: 100%;
}

input[type='color'] {
  width: 100%;
  min-height: 38px;
  padding: 4px;
}

textarea {
  resize: vertical;
  min-height: 64px;
}

.muted {
  margin: 0;
  color: #475569;
  font-size: 0.83rem;
}

.hidden {
  display: none;
}

.cropper-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  padding: 14px;
  z-index: 100;
}

.cropper-modal {
  width: min(980px, 100%);
  background: linear-gradient(180deg, #f8fafc, #e2e8f0);
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: var(--radius-l);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
  padding: 12px;
}

.cropper-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.cropper-header h2 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.02em;
}

.cropper-content {
  display: grid;
  grid-template-columns: 1fr minmax(280px, 350px);
  gap: 12px;
}

.crop-preview-wrap {
  background: linear-gradient(180deg, #dce7f5, #e2e8f0);
  border-radius: var(--radius-m);
  border: 1px solid rgba(15, 23, 42, 0.18);
  padding: 10px;
}

.crop-preview {
  width: 100%;
  height: auto;
  border-radius: 10px;
  display: block;
}

.crop-preview-wrap p {
  margin: 8px 0 0;
  font-size: 0.82rem;
  color: #334155;
}

.crop-fields {
  display: grid;
  gap: 8px;
}

.crop-fields label {
  display: grid;
  gap: 4px;
  font-size: 0.82rem;
}

.notice {
  position: fixed;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  background: #0f172a;
  color: #f8fafc;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  max-width: min(80vw, 760px);
  text-align: center;
  z-index: 120;
}

@media (max-width: 1140px) {
  .topbar {
    grid-template-columns: 1fr;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .panel {
    position: static;
    max-height: none;
  }

  .cropper-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .app-shell {
    padding: 10px;
  }

  .title-wrap,
  .top-actions,
  .panel,
  .canvas-wrap {
    border-radius: 12px;
  }
}
</style>
