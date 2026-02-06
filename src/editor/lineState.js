export function createLineHelpers({ createId, toNumber }) {
  function clonePoints(points) {
    return Array.isArray(points) ? [...points] : []
  }

  function normalizeLine(rawLine) {
    return {
      id: rawLine?.id || createId('line'),
      tool: rawLine?.tool === 'erase' ? 'erase' : 'pen',
      color: rawLine?.color || '#0f766e',
      size: Math.max(1, Math.round(toNumber(rawLine?.size, 10))),
      points: clonePoints(rawLine?.points),
    }
  }

  function cloneLineList(list) {
    if (!Array.isArray(list)) {
      return []
    }
    return list.map((line) => normalizeLine(line))
  }

  function snapshotImageBlockState(block) {
    return {
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
      lines: cloneLineList(block.lines),
    }
  }

  function hydrateImageBlockState(block, state, image) {
    block.label = state.label || 'Image'
    block.src = state.src
    block.image = image
    block.x = toNumber(state.x)
    block.y = toNumber(state.y)
    block.width = Math.max(20, Math.round(toNumber(state.width, block.width)))
    block.height = Math.max(20, Math.round(toNumber(state.height, block.height)))
    block.rotation = toNumber(state.rotation)
    block.scaleX = toNumber(state.scaleX, 1) || 1
    block.scaleY = toNumber(state.scaleY, 1) || 1
    block.brightness = toNumber(state.brightness)
    block.contrast = toNumber(state.contrast)
    block.saturation = toNumber(state.saturation)
    block.hue = toNumber(state.hue)
    block.lines = cloneLineList(state.lines)
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
        lines: cloneLineList(block.lines),
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

  return {
    clonePoints,
    normalizeLine,
    cloneLineList,
    snapshotImageBlockState,
    hydrateImageBlockState,
    serializeBlock,
  }
}
