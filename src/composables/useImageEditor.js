import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Konva from 'konva'
import { clamp, toNumber } from '../editor/number'
import {
  applyBlockTransformState,
  clampPointerToImageBlock,
  createDuplicateImageBlockState,
  createImageBlockState,
  createTextBlockState,
  flipImageBlockState,
  getBlocksBounds,
  getImageBlockGroupConfig as buildImageBlockGroupConfig,
  getImageFrameConfig as buildImageFrameConfig,
  getImageLineClipConfig as buildImageLineClipConfig,
  getImageNodeConfig as buildImageNodeConfig,
  getLineNodeConfig as buildLineNodeConfig,
  getNextImageBlockPosition,
  getTextNodeConfig as buildTextNodeConfig,
  hydrateImageBlockStateFromRaw,
  hydrateTextBlockStateFromRaw,
} from '../editor/blocks'
import { createLineHelpers } from '../editor/lineState'
import { createDefaultBlockDataUrl, createSampleImageDataUrl } from '../editor/placeholders'
import { downloadBlob, downloadDataUrl, mimeToExtension } from '../editor/download'
export function useImageEditor() {
  const MAX_UNDO_STEPS = 5
  const MAX_HISTORY_STATES = MAX_UNDO_STEPS + 1
  const IMAGE_FILTERS = [Konva.Filters.Brighten, Konva.Filters.Contrast, Konva.Filters.HSL]
  const ZOOM_MIN = 0.35
  const ZOOM_MAX = 3.5
  const ZOOM_STEP = 1.08
  const CANVAS_INSET = 20
  const BLOCK_GROUP_NAME = 'image-block-group'
  const CACHE_MAX_EDGE = 1200

  const stageRef = ref(null)
  const transformerRef = ref(null)
  const canvasWrapRef = ref(null)
  const imageInputRef = ref(null)
  const replaceImageInputRef = ref(null)
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

  const selectedId = ref('')
  const tool = ref('select')
  const isDrawing = ref(false)
  const drawingBlockId = ref('')

  const brushColor = ref('#0f766e')
  const brushSize = ref(10)
  const eraserSize = ref(22)

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

  const cropper = reactive({
    visible: false,
    mode: 'upload',
    preserveBlockSize: false,
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
  const recacheFrameById = new Map()

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
  const activeToolLabel = computed(() => (panMode.value ? 'pan' : tool.value))
  const historyCounter = computed(() => {
    if (!selectedImage.value) {
      return '0/0'
    }

    const blockHistory = Array.isArray(selectedImage.value.history) ? selectedImage.value.history : []
    const historyIndex = Number.isFinite(selectedImage.value.historyIndex) ? selectedImage.value.historyIndex : -1
    const current = historyIndex >= 0 ? historyIndex + 1 : 0
    return `${current}/${blockHistory.length}`
  })
  const zoomPercent = computed(() => `${Math.round(stageViewport.scale * 100)}%`)

  const canUndo = computed(() => {
    if (!selectedImage.value) {
      return false
    }

    const historyIndex = Number.isFinite(selectedImage.value.historyIndex) ? selectedImage.value.historyIndex : -1
    return historyIndex > 0
  })
  const canRedo = computed(() => {
    if (!selectedImage.value) {
      return false
    }

    const blockHistory = Array.isArray(selectedImage.value.history) ? selectedImage.value.history : []
    const historyIndex = Number.isFinite(selectedImage.value.historyIndex) ? selectedImage.value.historyIndex : -1
    return historyIndex >= 0 && historyIndex < blockHistory.length - 1
  })

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
    fillLinearGradientColorStops: [0, '#020617', 0.5, '#0b1221', 1, '#111827'],
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
    if (nextState) {
      finishDrawingStroke()
    }

    panMode.value = Boolean(nextState)
    if (panMode.value) {
      selectedId.value = ''
      nextTick(updateTransformer)
    }
  }

  function togglePanMode() {
    setPanMode(!panMode.value)
  }

  function resetSelectedBlockState() {
    if (!selectedBlock.value) {
      return
    }

    const block = selectedBlock.value
    block.x = Math.max(0, Math.round((stageSize.width - block.width) / 2))
    block.y = Math.max(0, Math.round((stageSize.height - block.height) / 2))
    block.rotation = 0
    block.scaleX = 1
    block.scaleY = 1

    if (block.kind === 'image') {
      block.brightness = 0
      block.contrast = 0
      block.saturation = 0
      block.hue = 0
      syncImageControls()
      nextTick(() => recacheImageNode(block.id))
    }

    pushHistory(block)
    nextTick(updateTransformer)
  }

  function fitViewportToBounds(bounds, padding = 56) {
    if (!bounds) {
      return
    }

    const contentWidth = Math.max(1, bounds.maxX - bounds.minX)
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY)
    const totalWidth = contentWidth + padding * 2
    const totalHeight = contentHeight + padding * 2

    const scaleByWidth = stageSize.width / totalWidth
    const scaleByHeight = stageSize.height / totalHeight
    const nextScale = clamp(Math.min(scaleByWidth, scaleByHeight), ZOOM_MIN, 1)

    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2

    stageViewport.scale = nextScale
    stageViewport.x = stageSize.width / 2 - centerX * nextScale
    stageViewport.y = stageSize.height / 2 - centerY * nextScale
  }

  function fitViewportToAllBlocks() {
    const bounds = getBlocksBounds(blocks.value)
    fitViewportToBounds(bounds)
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
    const toolChanged = tool.value !== nextTool

    if (toolChanged) {
      finishDrawingStroke()
    }

    tool.value = nextTool
    if (panMode.value || nextTool !== 'select') {
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

  const {
    cloneLineList,
    snapshotImageBlockState,
    hydrateImageBlockState,
    serializeBlock,
  } = createLineHelpers({ createId, toNumber })

  function getImageBlockById(id) {
    if (!id) {
      return null
    }
    return blocks.value.find((item) => item.id === id && item.kind === 'image') || null
  }

  function pushHistory(targetBlock = selectedImage.value) {
    if (!targetBlock || targetBlock.kind !== 'image') {
      return
    }

    if (targetBlock.isRestoringHistory) {
      return
    }

    if (!Array.isArray(targetBlock.history)) {
      targetBlock.history = []
    }
    if (!Number.isFinite(targetBlock.historyIndex)) {
      targetBlock.historyIndex = targetBlock.history.length - 1
    }

    const nextSnapshot = snapshotImageBlockState(targetBlock)
    const truncatedHistory = targetBlock.history.slice(0, targetBlock.historyIndex + 1)
    truncatedHistory.push(nextSnapshot)

    while (truncatedHistory.length > MAX_HISTORY_STATES) {
      truncatedHistory.shift()
    }

    targetBlock.history = truncatedHistory
    targetBlock.historyIndex = truncatedHistory.length - 1
  }

  function snapshotState() {
    return {
      blocks: blocks.value.map((block) => serializeBlock(block)),
      lines: [],
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
      const fallbackSrc = createDefaultBlockDataUrl()
      const safeSrc = typeof rawBlock.src === 'string' && rawBlock.src ? rawBlock.src : fallbackSrc
      if (!safeSrc) {
        throw new Error('Image source is missing')
      }

      const image = await getImageElement(safeSrc)
      return hydrateImageBlockStateFromRaw({
        rawBlock: {
          ...rawBlock,
          src: safeSrc,
        },
        createId,
        image,
        cloneLineList,
      })
    }

    return hydrateTextBlockStateFromRaw({
      rawBlock,
      createId,
    })
  }

  async function applySnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.blocks)) {
      throw new Error('Invalid snapshot format')
    }

    const hydratedBlocks = []
    for (const rawBlock of snapshot.blocks) {
      hydratedBlocks.push(await hydrateBlock(rawBlock))
    }

    const legacyLines = Array.isArray(snapshot.lines) ? cloneLineList(snapshot.lines) : []
    if (legacyLines.length > 0) {
      const firstImageBlock = hydratedBlocks.find((item) => item.kind === 'image')
      if (firstImageBlock && firstImageBlock.lines.length === 0) {
        firstImageBlock.lines = legacyLines
      }
    }

    blocks.value = hydratedBlocks

    selectedId.value = ''
    drawingBlockId.value = ''

    await nextTick()
    for (const block of blocks.value) {
      if (block.kind === 'image') {
        recacheImageNode(block.id)
        block.history = []
        block.historyIndex = -1
        block.isRestoringHistory = false
        pushHistory(block)
      }
    }
    updateTransformer()
  }

  async function restoreFromHistory(targetIndex) {
    const targetBlock = selectedImage.value
    if (!targetBlock) {
      return
    }

    const blockHistory = Array.isArray(targetBlock.history) ? targetBlock.history : []

    if (targetIndex < 0 || targetIndex >= blockHistory.length) {
      return
    }

    const target = blockHistory[targetIndex]
    if (!target) {
      return
    }

    try {
      targetBlock.isRestoringHistory = true
      const historyImage = await getImageElement(target.src)
      hydrateImageBlockState(targetBlock, target, historyImage)

      await nextTick()
      recacheImageNode(targetBlock.id)
      targetBlock.historyIndex = targetIndex
      updateTransformer()
    } catch (error) {
      setNotice(`History restore failed: ${error.message}`)
    } finally {
      targetBlock.isRestoringHistory = false
    }
  }

  async function undo() {
    if (!canUndo.value) {
      return
    }

    const historyIndex = Number.isFinite(selectedImage.value?.historyIndex) ? selectedImage.value.historyIndex : -1
    await restoreFromHistory(historyIndex - 1)
  }

  async function redo() {
    if (!canRedo.value) {
      return
    }

    const historyIndex = Number.isFinite(selectedImage.value?.historyIndex) ? selectedImage.value.historyIndex : -1
    await restoreFromHistory(historyIndex + 1)
  }

  function hasActiveImageFilters(block) {
    if (!block || block.kind !== 'image') {
      return false
    }

    return (
      Math.abs(block.brightness) > 0.0001 ||
      Math.abs(block.contrast) > 0.0001 ||
      Math.abs(block.saturation) > 0.0001 ||
      Math.abs(block.hue) > 0.0001
    )
  }

  function getCachePixelRatio(block) {
    const maxEdge = Math.max(1, Math.round(Math.max(block.width, block.height)))
    return clamp(CACHE_MAX_EDGE / maxEdge, 0.35, 1)
  }

  function scheduleRecacheImageNode(id) {
    if (!id || recacheFrameById.has(id)) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      recacheFrameById.delete(id)
      recacheImageNode(id)
    })

    recacheFrameById.set(id, frameId)
  }

  function recacheImageNode(id) {
    const stage = getStageNode()
    if (!stage) {
      return
    }

    const imageNode = stage.findOne(`#${id}-image`)
    if (!imageNode) {
      return
    }

    const block = getImageBlockById(id)
    if (!block) {
      return
    }

    const shouldCache = hasActiveImageFilters(block)

    try {
      const hasCache = typeof imageNode.isCached === 'function' ? imageNode.isCached() : true

      if (!shouldCache) {
        if (hasCache) {
          imageNode.clearCache()
        }
        imageNode.getLayer()?.batchDraw()
        return
      }

      imageNode.clearCache()
      imageNode.cache({
        pixelRatio: getCachePixelRatio(block),
      })
      imageNode.getLayer()?.batchDraw()
    } catch {
      imageNode.getLayer()?.batchDraw()
    }
  }

  function getImageBlockGroupConfig(block) {
    return buildImageBlockGroupConfig(block, {
      blockGroupName: BLOCK_GROUP_NAME,
      isDraggable: tool.value === 'select' && !panMode.value,
    })
  }

  function getImageLineClipConfig(block) {
    return buildImageLineClipConfig(block)
  }

  function getImageFrameConfig(block) {
    return buildImageFrameConfig(block, {
      isSelected: selectedId.value === block.id,
      canInteractByFrame: tool.value === 'select' && !panMode.value,
    })
  }

  function getImageNodeConfig(block) {
    return buildImageNodeConfig(block, {
      isDraggable: false,
      imageFilters: IMAGE_FILTERS,
      filtersEnabled: hasActiveImageFilters(block),
    })
  }

  function getTextNodeConfig(block) {
    return buildTextNodeConfig(block, {
      isDraggable: tool.value === 'select' && !panMode.value,
    })
  }

  function getLineNodeConfig(line) {
    return buildLineNodeConfig(line)
  }

  function getImageBlockFromTarget(target) {
    const groupNode = target?.findAncestor?.(`.${BLOCK_GROUP_NAME}`, true)
    if (!groupNode) {
      return null
    }
    return getImageBlockById(groupNode.id())
  }

  function getImageBlockNode(id) {
    const stage = getStageNode()
    if (!stage || !id) {
      return null
    }
    return stage.findOne(`#${id}`)
  }

  function finishDrawingStroke() {
    if (!isDrawing.value) {
      return
    }

    const drawnBlock = getImageBlockById(drawingBlockId.value)
    isDrawing.value = false
    drawingBlockId.value = ''

    if (drawnBlock) {
      pushHistory(drawnBlock)
    }
  }

  function onWindowPointerUp() {
    finishDrawingStroke()
  }

  function onStageMouseDown(event) {
    const stage = event.target.getStage()
    if (!stage) {
      return
    }

    if (panMode.value) {
      return
    }

    if (tool.value === 'pen' || tool.value === 'erase') {
      const sourceBlock = getImageBlockFromTarget(event.target)
      if (!sourceBlock) {
        return
      }

      const sourceGroup = getImageBlockNode(sourceBlock.id)
      const pointer = sourceGroup?.getRelativePointerPosition?.()
      if (!pointer) {
        return
      }

      const localPointer = clampPointerToImageBlock(pointer, sourceBlock)

      isDrawing.value = true
      drawingBlockId.value = sourceBlock.id
      selectedId.value = sourceBlock.id

      const strokeSize = tool.value === 'erase' ? eraserSize.value : brushSize.value
      const strokeColor = tool.value === 'erase' ? '#000000' : brushColor.value

      sourceBlock.lines.push({
        id: createId('line'),
        tool: tool.value,
        color: strokeColor,
        size: strokeSize,
        points: [localPointer.x, localPointer.y],
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

    const drawingBlock = getImageBlockById(drawingBlockId.value)
    if (!drawingBlock) {
      finishDrawingStroke()
      return
    }

    const drawingGroup = getImageBlockNode(drawingBlock.id)
    const pointer = drawingGroup?.getRelativePointerPosition?.()
    if (!pointer || drawingBlock.lines.length === 0) {
      return
    }

    const localPointer = clampPointerToImageBlock(pointer, drawingBlock)
    const lastLineIndex = drawingBlock.lines.length - 1
    const lastLine = drawingBlock.lines[lastLineIndex]
    const updatedPoints = [...lastLine.points, localPointer.x, localPointer.y]

    drawingBlock.lines.splice(lastLineIndex, 1, {
      ...lastLine,
      points: updatedPoints,
    })
  }

  function onStageMouseUp() {
    if (panMode.value) {
      return
    }

    finishDrawingStroke()
  }

  function onBlockDragEnd(block, event) {
    const targetId = event?.target?.id?.()
    if (targetId !== block.id) {
      return
    }

    block.x = event.target.x()
    block.y = event.target.y()
    pushHistory(block)
  }

  function onBlockTransformEnd(block, event) {
    const node = event.target
    applyBlockTransformState(block, node)

    if (block.kind === 'image') {
      nextTick(() => recacheImageNode(block.id))
    }

    pushHistory(block)
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

    scheduleRecacheImageNode(selectedImage.value.id)
  }

  function commitImageControlChange() {
    if (!selectedImage.value) {
      return
    }
    pushHistory(selectedImage.value)
  }

  function flipSelectedImage(axis) {
    if (!selectedImage.value) {
      return
    }

    const block = selectedImage.value

    flipImageBlockState(block, axis)

    pushHistory(block)
    nextTick(updateTransformer)
  }

  function rotateSelectedBy(delta) {
    if (!selectedBlock.value) {
      return
    }

    selectedBlock.value.rotation += delta
    if (selectedBlock.value.kind === 'image') {
      pushHistory(selectedBlock.value)
    }
    nextTick(updateTransformer)
  }

  function addTextBlock() {
    const block = createTextBlockState({ createId })

    blocks.value.push(block)
    selectedId.value = block.id
    nextTick(updateTransformer)
  }

  function duplicateSelectedBlock() {
    if (!selectedImage.value) {
      return
    }

    const source = selectedImage.value
    const duplicate = createDuplicateImageBlockState({
      createId,
      source,
      cloneLineList,
    })

    blocks.value.push(duplicate)
    selectedId.value = duplicate.id
    pushHistory(duplicate)
    nextTick(() => {
      recacheImageNode(duplicate.id)
      updateTransformer()
    })
  }

  function removeSelectedBlock() {
    if (!selectedBlock.value) {
      return
    }

    if (drawingBlockId.value === selectedBlock.value.id) {
      isDrawing.value = false
      drawingBlockId.value = ''
    }

    blocks.value = blocks.value.filter((item) => item.id !== selectedBlock.value.id)
    selectedId.value = ''
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
  }

  function triggerImagePicker() {
    imageInputRef.value?.click()
  }

  function triggerReplaceImagePicker() {
    if (!selectedImage.value) {
      setNotice('Select an image block first.')
      return
    }
    replaceImageInputRef.value?.click()
  }

  async function addDefaultBlock() {
    try {
      const blockSrc = createDefaultBlockDataUrl()
      if (!blockSrc) {
        setNotice('New block generation failed.')
        return
      }

      await addImageBlockFromSrc(blockSrc, 'new-block.png', {
        layout: 'after-image-blocks',
      })
      fitViewportToAllBlocks()
    } catch (error) {
      setNotice(`Add block failed: ${error.message}`)
    }
  }

  async function addSampleImageBlock() {
    try {
      const sampleSrc = createSampleImageDataUrl()
      if (!sampleSrc) {
        setNotice('Sample image generation failed.')
        return
      }

      await addImageBlockFromSrc(sampleSrc, 'sample-demo.png', {
        layout: 'after-image-blocks',
      })
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

  async function onReplaceImageInputChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!selectedImage.value) {
      setNotice('Select an image block first.')
      return
    }

    if (!file.type.startsWith('image/')) {
      setNotice('Only image files are supported.')
      return
    }

    try {
      const src = await readFileAsDataUrl(file)
      cropper.queue = []
      await openCropper(src, file.name, 'edit', selectedImage.value.id, {
        preserveBlockSize: true,
      })
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function addImageBlockFromSrc(src, label = 'Image', options = {}) {
    const image = await getImageElement(src)

    const position =
      options.position ||
      (options.layout === 'after-image-blocks'
        ? getNextImageBlockPosition(imageBlocks.value, stageSize.width)
        : {
            x: 36 + (blocks.value.length % 6) * 16,
            y: 36 + (blocks.value.length % 6) * 16,
          })

    const block = createImageBlockState({
      createId,
      image,
      label,
      src,
      position,
    })

    blocks.value.push(block)
    selectedId.value = block.id

    await nextTick()
    recacheImageNode(block.id)
    syncImageControls()
    pushHistory(block)
    updateTransformer()

    return block
  }

  async function openCropper(src, name, mode = 'upload', targetId = '', options = {}) {
    cropper.mode = mode
    cropper.preserveBlockSize = Boolean(options.preserveBlockSize)
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

    if (cropper.preserveBlockSize) {
      const targetBlock = getImageBlockById(targetId)
      if (targetBlock) {
        cropper.outputWidth = clamp(Math.round(toNumber(targetBlock.width, cropper.outputWidth)), 1, 4096)
        cropper.outputHeight = clamp(Math.round(toNumber(targetBlock.height, cropper.outputHeight)), 1, 4096)
      }
    }

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
    await openCropper(nextEntry.src, nextEntry.name, 'upload', '', {
      preserveBlockSize: false,
    })
  }

  async function openCropperForSelectedImage() {
    if (!selectedImage.value) {
      return
    }

    cropper.queue = []
    await openCropper(selectedImage.value.src, selectedImage.value.label, 'edit', selectedImage.value.id, {
      preserveBlockSize: false,
    })
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
    cropper.preserveBlockSize = false
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
        await addImageBlockFromSrc(dataUrl, name, {
          layout: 'after-image-blocks',
        })

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
      const previousWidth = Math.max(1, target.width)
      const previousHeight = Math.max(1, target.height)
      const shouldPreserveSize = cropper.preserveBlockSize

      target.src = dataUrl
      target.image = image

      if (!shouldPreserveSize) {
        target.width = cropper.outputWidth
        target.height = cropper.outputHeight

        if (target.lines.length > 0) {
          const scaleX = target.width / previousWidth
          const scaleY = target.height / previousHeight
          target.lines = target.lines.map((line) => ({
            ...line,
            points: line.points.map((value, index) => {
              return index % 2 === 0 ? value * scaleX : value * scaleY
            }),
          }))
        }
      }

      await nextTick()
      recacheImageNode(target.id)
      pushHistory(target)
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
      }
    } catch {
      setNotice('Color picking cancelled.')
    }
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
      const snapshot =
        (parsed && parsed.snapshot) ||
        (parsed && parsed.board && parsed.board.snapshot) ||
        (parsed && Array.isArray(parsed.boards) && parsed.boards[0] && parsed.boards[0].snapshot) ||
        parsed

      await applySnapshot(snapshot)
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
    window.addEventListener('mouseup', onWindowPointerUp)
    window.addEventListener('touchend', onWindowPointerUp)
    window.addEventListener('touchcancel', onWindowPointerUp)
    addSampleImageBlock()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateStageSize)
    window.removeEventListener('mouseup', onWindowPointerUp)
    window.removeEventListener('touchend', onWindowPointerUp)
    window.removeEventListener('touchcancel', onWindowPointerUp)

    for (const frameId of recacheFrameById.values()) {
      window.cancelAnimationFrame(frameId)
    }
    recacheFrameById.clear()

    if (noticeTimer) {
      window.clearTimeout(noticeTimer)
    }
  })

  return {
    stageRef,
    transformerRef,
    canvasWrapRef,
    imageInputRef,
    replaceImageInputRef,
    importJsonInputRef,
    cropPreviewRef,
    panMode,
    tool,
    brushColor,
    brushSize,
    eraserSize,
    imageControls,
    exportOptions,
    cropper,
    notice,
    selectedBlock,
    selectedImage,
    selectedText,
    imageBlocks,
    textBlocks,
    totalBlocks,
    selectedKindLabel,
    activeToolLabel,
    historyCounter,
    zoomPercent,
    canUndo,
    canRedo,
    stageConfig,
    stageBackgroundConfig,
    transformerConfig,
    syncExportSizeWithStage,
    zoomIn,
    zoomOut,
    resetStageView,
    onStageWheel,
    onStageDragEnd,
    togglePanMode,
    resetSelectedBlockState,
    focusSelectedBlock,
    setTool,
    selectBlock,
    undo,
    redo,
    getImageBlockGroupConfig,
    getImageLineClipConfig,
    getImageFrameConfig,
    getImageNodeConfig,
    getTextNodeConfig,
    getLineNodeConfig,
    onStageMouseDown,
    onStageMouseMove,
    onStageMouseUp,
    onBlockDragEnd,
    onBlockTransformEnd,
    onImageControlInput,
    commitImageControlChange,
    flipSelectedImage,
    rotateSelectedBy,
    addTextBlock,
    duplicateSelectedBlock,
    removeSelectedBlock,
    updateTextContent,
    updateTextColor,
    updateTextSize,
    commitTextChange,
    triggerImagePicker,
    triggerReplaceImagePicker,
    addDefaultBlock,
    addSampleImageBlock,
    triggerImportStatePicker,
    onImageInputChange,
    onReplaceImageInputChange,
    openCropperForSelectedImage,
    setCropFullImage,
    setCropSquareCenter,
    renderCropPreview,
    closeCropper,
    applyCropper,
    pickColorWithEyedropper,
    exportImage,
    exportStateJson,
    onImportStateChange,
  }
}
