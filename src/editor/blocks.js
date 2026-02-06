import { clamp, toNumber } from './number'

const MIN_BLOCK_SIZE = 20
const IMAGE_MAX_START_WIDTH = 360

export function getBlockBounds(block) {
  const x2 = block.x + block.scaleX * block.width
  const y2 = block.y + block.scaleY * block.height

  return {
    minX: Math.min(block.x, x2),
    minY: Math.min(block.y, y2),
    maxX: Math.max(block.x, x2),
    maxY: Math.max(block.y, y2),
  }
}

export function getBlocksBounds(list = []) {
  if (!Array.isArray(list) || list.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const block of list) {
    const bounds = getBlockBounds(block)
    minX = Math.min(minX, bounds.minX)
    minY = Math.min(minY, bounds.minY)
    maxX = Math.max(maxX, bounds.maxX)
    maxY = Math.max(maxY, bounds.maxY)
  }

  return { minX, minY, maxX, maxY }
}

export function getNextImageBlockPosition(imageList, stageWidth = 0) {
  if (!Array.isArray(imageList) || imageList.length === 0) {
    return {
      x: 36,
      y: 36,
    }
  }

  const bounds = getBlocksBounds(imageList)
  if (!bounds) {
    return {
      x: 36,
      y: 36,
    }
  }

  const nextX = Math.round(bounds.maxX + 48)
  const nextY = Math.round(bounds.minY)

  if (Number.isFinite(stageWidth) && stageWidth > 0) {
    const wrapThresholdX = Math.max(220, Math.round(stageWidth - 220))
    if (nextX > wrapThresholdX) {
      return {
        x: 36,
        y: Math.round(bounds.maxY + 48),
      }
    }
  }

  return {
    x: nextX,
    y: nextY,
  }
}

export function createImageBlockState({ createId, image, label = 'Image', src, position }) {
  const sourceWidth = image.naturalWidth || image.width || 1
  const sourceHeight = image.naturalHeight || image.height || 1
  const startScale = Math.min(1, IMAGE_MAX_START_WIDTH / sourceWidth)
  const width = Math.max(MIN_BLOCK_SIZE, Math.round(sourceWidth * startScale))
  const height = Math.max(MIN_BLOCK_SIZE, Math.round(sourceHeight * startScale))

  return {
    kind: 'image',
    id: createId('img'),
    label,
    src,
    image,
    x: Math.round(toNumber(position?.x, 36)),
    y: Math.round(toNumber(position?.y, 36)),
    width,
    height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    lines: [],
    history: [],
    historyIndex: -1,
    isRestoringHistory: false,
  }
}

export function createTextBlockState({ createId }) {
  return {
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
}

export function createDuplicateImageBlockState({ createId, source, cloneLineList }) {
  return {
    kind: 'image',
    id: createId('img'),
    label: source.label,
    src: source.src,
    image: source.image,
    x: source.x + 24,
    y: source.y + 24,
    width: source.width,
    height: source.height,
    rotation: source.rotation,
    scaleX: source.scaleX,
    scaleY: source.scaleY,
    brightness: source.brightness,
    contrast: source.contrast,
    saturation: source.saturation,
    hue: source.hue,
    lines: cloneLineList(source.lines),
    history: [],
    historyIndex: -1,
    isRestoringHistory: false,
  }
}

export function hydrateImageBlockStateFromRaw({ rawBlock, createId, image, cloneLineList }) {
  return {
    kind: 'image',
    id: rawBlock.id || createId('img'),
    label: rawBlock.label || 'Image',
    src: rawBlock.src,
    image,
    x: toNumber(rawBlock.x),
    y: toNumber(rawBlock.y),
    width: Math.max(MIN_BLOCK_SIZE, Math.round(toNumber(rawBlock.width, image.naturalWidth || image.width))),
    height: Math.max(MIN_BLOCK_SIZE, Math.round(toNumber(rawBlock.height, image.naturalHeight || image.height))),
    rotation: toNumber(rawBlock.rotation),
    scaleX: toNumber(rawBlock.scaleX, 1) || 1,
    scaleY: toNumber(rawBlock.scaleY, 1) || 1,
    brightness: toNumber(rawBlock.brightness),
    contrast: toNumber(rawBlock.contrast),
    saturation: toNumber(rawBlock.saturation),
    hue: toNumber(rawBlock.hue),
    lines: cloneLineList(rawBlock.lines),
    history: [],
    historyIndex: -1,
    isRestoringHistory: false,
  }
}

export function hydrateTextBlockStateFromRaw({ rawBlock, createId }) {
  return {
    kind: 'text',
    id: rawBlock.id || createId('txt'),
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

export function getImageBlockGroupConfig(block, { blockGroupName, isDraggable }) {
  return {
    id: block.id,
    name: blockGroupName,
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    rotation: block.rotation,
    scaleX: block.scaleX,
    scaleY: block.scaleY,
    draggable: isDraggable,
  }
}

export function getImageLineClipConfig(block) {
  return {
    clip: {
      x: 0,
      y: 0,
      width: block.width,
      height: block.height,
    },
    listening: false,
  }
}

export function getImageFrameConfig(block, { isSelected, canInteractByFrame }) {
  let stroke = '#67e8f9'
  let strokeWidth = 2.5
  let fill = 'rgba(103, 232, 249, 0.08)'
  let dash = [8, 5]
  let shadowColor = 'rgba(34, 211, 238, 0.35)'
  let shadowBlur = 6

  if (isSelected) {
    stroke = '#22c55e'
    strokeWidth = 4
    fill = 'rgba(34, 197, 94, 0.14)'
    dash = []
    shadowColor = 'rgba(34, 197, 94, 0.45)'
    shadowBlur = 12
  }

  return {
    x: 0,
    y: 0,
    width: block.width,
    height: block.height,
    fill,
    stroke,
    strokeWidth,
    dash,
    shadowColor,
    shadowBlur,
    shadowOpacity: 0.9,
    hitStrokeWidth: 14,
    strokeScaleEnabled: false,
    listening: canInteractByFrame,
  }
}

export function getImageNodeConfig(block, { isDraggable, imageFilters, filtersEnabled }) {
  return {
    id: `${block.id}-image`,
    x: 0,
    y: 0,
    image: block.image,
    width: block.width,
    height: block.height,
    draggable: isDraggable,
    listening: true,
    filters: filtersEnabled ? imageFilters : [],
    brightness: block.brightness,
    contrast: block.contrast,
    saturation: block.saturation,
    hue: block.hue,
  }
}

export function getTextNodeConfig(block, { isDraggable }) {
  return {
    id: block.id,
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    rotation: block.rotation,
    scaleX: block.scaleX,
    scaleY: block.scaleY,
    draggable: isDraggable,
    text: block.text,
    fontSize: block.fontSize,
    fontFamily: block.fontFamily,
    fill: block.fill,
    align: 'left',
    verticalAlign: 'top',
  }
}

export function getLineNodeConfig(line) {
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

export function clampPointerToImageBlock(pointer, block) {
  return {
    x: clamp(toNumber(pointer?.x), 0, block.width),
    y: clamp(toNumber(pointer?.y), 0, block.height),
  }
}

export function applyBlockTransformState(block, node) {
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()
  const absScaleX = Math.abs(scaleX)
  const absScaleY = Math.abs(scaleY)

  const signX = scaleX < 0 ? -1 : 1
  const signY = scaleY < 0 ? -1 : 1

  block.x = node.x()
  block.y = node.y()
  block.rotation = node.rotation()

  if (block.kind === 'image') {
    block.width = Math.max(MIN_BLOCK_SIZE, Math.round(block.width * absScaleX))
    block.height = Math.max(MIN_BLOCK_SIZE, Math.round(block.height * absScaleY))

    if (block.lines.length > 0) {
      block.lines = block.lines.map((line) => ({
        ...line,
        points: line.points.map((value, index) => {
          return index % 2 === 0 ? value * absScaleX : value * absScaleY
        }),
      }))
    }
  } else {
    block.width = Math.max(MIN_BLOCK_SIZE, Math.round(node.width() * absScaleX))
    block.height = Math.max(MIN_BLOCK_SIZE, Math.round(node.height() * absScaleY))
  }

  block.scaleX = signX
  block.scaleY = signY

  node.scaleX(signX)
  node.scaleY(signY)

  if (block.kind === 'text') {
    block.fontSize = Math.max(10, Math.round(block.fontSize * absScaleY))
  }
}

export function flipImageBlockState(block, axis) {
  if (axis === 'x') {
    const previousSign = block.scaleX < 0 ? -1 : 1
    block.x += previousSign * block.width
    block.scaleX *= -1
    return
  }

  const previousSign = block.scaleY < 0 ? -1 : 1
  block.y += previousSign * block.height
  block.scaleY *= -1
}
