<script setup>
import { ref as vueRef } from 'vue'
import { useImageEditor } from './composables/useImageEditor'
import { icons } from './editor/icons'

const openPopover = vueRef('')
let popoverCloseTimer = null

function showPopover(id) {
  if (popoverCloseTimer) {
    clearTimeout(popoverCloseTimer)
    popoverCloseTimer = null
  }
  openPopover.value = id
}

function hidePopover(id) {
  popoverCloseTimer = setTimeout(() => {
    if (openPopover.value === id) {
      openPopover.value = ''
    }
  }, 120)
}

function keepPopover(id) {
  if (popoverCloseTimer) {
    clearTimeout(popoverCloseTimer)
    popoverCloseTimer = null
  }
  openPopover.value = id
}

const {
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
  renderImageBlocks,
  renderTextBlocks,
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
  fitViewportToAllBlocks,
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
} = useImageEditor()
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="title-wrap">
        <div class="title-row">
          <h1>Konva Image Editor</h1>
          <div class="status-row">
            <span class="status-pill">{{ activeToolLabel }}</span>
            <span class="status-pill">{{ zoomPercent }}</span>
            <span class="status-pill">{{ totalBlocks }} blocks</span>
            <span class="status-pill">{{ historyCounter }}</span>
          </div>
        </div>
      </div>
    </header>

    <div class="workspace">
      <div ref="canvasWrapRef" class="canvas-wrap">
        <!-- Left toolbar -->
        <div class="canvas-overlay canvas-overlay-left">
          <div class="toolbar overlay-row">
            <button class="icon-btn" data-tip="Add block" @click="addDefaultBlock">
              <span v-html="icons.plusSquare" />
            </button>
            <button class="icon-btn" data-tip="Upload" @click="triggerImagePicker">
              <span v-html="icons.upload" />
            </button>
            <button
              class="icon-btn"
              data-tip="Replace"
              :disabled="!selectedImage"
              @click="triggerReplaceImagePicker"
            >
              <span v-html="icons.replace" />
            </button>
            <button class="icon-btn" data-tip="Add text" @click="addTextBlock">
              <span v-html="icons.text" />
            </button>

            <span class="toolbar-sep" />

            <button class="icon-btn" data-tip="Undo" :disabled="!canUndo" @click="undo">
              <span v-html="icons.undo" />
            </button>
            <button class="icon-btn" data-tip="Redo" :disabled="!canRedo" @click="redo">
              <span v-html="icons.redo" />
            </button>
          </div>

          <!-- Tools with hover settings -->
          <div class="toolbar overlay-row">
            <button
              class="icon-btn"
              :class="{ active: !panMode && tool === 'select' }"
              data-tip="Select"
              @click="setTool('select')"
            >
              <span v-html="icons.cursor" />
            </button>

            <!-- Brush with managed popover -->
            <div
              class="popover-anchor popover-anchor-left"
              @mouseenter="showPopover('brush')"
              @mouseleave="hidePopover('brush')"
            >
              <button
                class="icon-btn"
                :class="{ active: !panMode && tool === 'pen' }"
                data-tip="Brush"
                @click="setTool('pen')"
              >
                <span v-html="icons.brush" />
              </button>
              <div
                class="popover popover-below"
                :class="{ 'popover-open': openPopover === 'brush' }"
                @mouseenter="keepPopover('brush')"
                @mouseleave="hidePopover('brush')"
              >
                <div class="popover-inner">
                  <label class="popover-field">
                    <span class="popover-label">Color</span>
                    <input v-model="brushColor" type="color" class="color-swatch" />
                  </label>
                  <label class="popover-field">
                    <span class="popover-label">Size: {{ brushSize }}px</span>
                    <input v-model.number="brushSize" type="range" min="1" max="50" step="1" />
                  </label>
                  <button class="mini-btn" @click="pickColorWithEyedropper">
                    <span v-html="icons.eyedropper" /> Pick
                  </button>
                </div>
              </div>
            </div>

            <!-- Eraser with managed popover -->
            <div
              class="popover-anchor popover-anchor-left"
              @mouseenter="showPopover('eraser')"
              @mouseleave="hidePopover('eraser')"
            >
              <button
                class="icon-btn"
                :class="{ active: !panMode && tool === 'erase' }"
                data-tip="Eraser"
                @click="setTool('erase')"
              >
                <span v-html="icons.eraser" />
              </button>
              <div
                class="popover popover-below"
                :class="{ 'popover-open': openPopover === 'eraser' }"
                @mouseenter="keepPopover('eraser')"
                @mouseleave="hidePopover('eraser')"
              >
                <div class="popover-inner">
                  <label class="popover-field">
                    <span class="popover-label">Size: {{ eraserSize }}px</span>
                    <input v-model.number="eraserSize" type="range" min="2" max="80" step="1" />
                  </label>
                </div>
              </div>
            </div>

            <button
              class="icon-btn"
              :class="{ active: panMode }"
              data-tip="Pan"
              @click="togglePanMode"
            >
              <span v-html="icons.pan" />
            </button>
          </div>
        </div>

        <!-- Right toolbar -->
        <div class="canvas-overlay canvas-overlay-right">
          <div class="toolbar overlay-row align-end">
            <button class="icon-btn" data-tip="Zoom in" @click="zoomIn">
              <span v-html="icons.zoomIn" />
            </button>
            <button class="icon-btn" data-tip="Zoom out" @click="zoomOut">
              <span v-html="icons.zoomOut" />
            </button>
            <button class="icon-btn" data-tip="Center" :disabled="!selectedBlock" @click="focusSelectedBlock">
              <span v-html="icons.crosshair" />
            </button>
            <button class="icon-btn" data-tip="Fit all" @click="fitViewportToAllBlocks">
              <span v-html="icons.fit" />
            </button>
            <button class="icon-btn" data-tip="Reset view" @click="resetStageView">
              <span v-html="icons.maximize" />
            </button>
            <button class="icon-btn danger" data-tip="Delete" :disabled="!selectedBlock" @click="removeSelectedBlock">
              <span v-html="icons.trash" />
            </button>
          </div>

          <!-- More actions managed popover -->
          <div
            class="popover-anchor popover-anchor-right"
            @mouseenter="showPopover('more')"
            @mouseleave="hidePopover('more')"
          >
            <button class="icon-btn" data-tip="More">
              <span v-html="icons.more" />
            </button>
            <div
              class="popover popover-below popover-wide"
              :class="{ 'popover-open': openPopover === 'more' }"
              @mouseenter="keepPopover('more')"
              @mouseleave="hidePopover('more')"
            >
              <div class="popover-inner">
                <div class="popover-section">
                  <span class="popover-heading">Actions</span>
                  <div class="popover-btn-row">
                    <button class="mini-btn" :disabled="!selectedImage" @click="duplicateSelectedBlock">
                      <span v-html="icons.copy" /> Duplicate
                    </button>
                    <button class="mini-btn" :disabled="!selectedImage" @click="openCropperForSelectedImage">
                      <span v-html="icons.crop" /> Crop
                    </button>
                    <button class="mini-btn" :disabled="!selectedImage" @click="flipSelectedImage('x')">
                      <span v-html="icons.flipX" /> Flip X
                    </button>
                    <button class="mini-btn" :disabled="!selectedImage" @click="flipSelectedImage('y')">
                      <span v-html="icons.flipY" /> Flip Y
                    </button>
                    <button class="mini-btn" :disabled="!selectedBlock" @click="rotateSelectedBy(15)">
                      <span v-html="icons.rotate" /> +15
                    </button>
                    <button class="mini-btn" :disabled="!selectedBlock" @click="resetSelectedBlockState">
                      <span v-html="icons.reset" /> Reset
                    </button>
                    <button class="mini-btn" @click="addSampleImageBlock">
                      <span v-html="icons.image" /> Sample
                    </button>
                  </div>
                </div>

                <div class="popover-section">
                  <span class="popover-heading">Export</span>
                  <div class="popover-btn-row">
                    <label class="popover-field popover-field-inline">
                      <select v-model="exportOptions.format">
                        <option value="image/png">PNG</option>
                        <option value="image/jpeg">JPEG</option>
                        <option value="image/webp">WebP</option>
                      </select>
                    </label>
                  </div>
                  <label class="popover-field">
                    <span class="popover-label">Quality {{ exportOptions.quality.toFixed(2) }}</span>
                    <input v-model.number="exportOptions.quality" type="range" min="0.1" max="1" step="0.01" />
                  </label>
                  <label class="popover-field">
                    <span class="popover-label">Pixel ratio {{ exportOptions.pixelRatio.toFixed(1) }}x</span>
                    <input v-model.number="exportOptions.pixelRatio" type="range" min="1" max="3" step="0.1" />
                  </label>
                  <div class="popover-btn-row">
                    <label class="popover-field popover-field-inline">
                      <span class="popover-label">W</span>
                      <input v-model.number="exportOptions.width" type="number" min="1" max="6000" class="num-input" />
                    </label>
                    <label class="popover-field popover-field-inline">
                      <span class="popover-label">H</span>
                      <input v-model.number="exportOptions.height" type="number" min="1" max="6000" class="num-input" />
                    </label>
                  </div>
                  <div class="popover-btn-row">
                    <button class="mini-btn" @click="syncExportSizeWithStage">Stage size</button>
                    <button class="mini-btn accent" @click="exportImage">
                      <span v-html="icons.download" /> Export
                    </button>
                  </div>
                </div>

                <div class="popover-section">
                  <span class="popover-heading">State</span>
                  <div class="popover-btn-row">
                    <button class="mini-btn" @click="exportStateJson">
                      <span v-html="icons.fileJson" /> Save JSON
                    </button>
                    <button class="mini-btn" @click="triggerImportStatePicker">
                      <span v-html="icons.fileImport" /> Load JSON
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom context bar: selected block / text settings -->
        <div
          v-if="selectedImage || selectedText"
          class="canvas-overlay canvas-overlay-bottom"
        >
          <div class="context-bar overlay-row">
            <!-- Image adjustments -->
            <template v-if="selectedImage">
              <div
                class="popover-anchor popover-anchor-left"
                @mouseenter="showPopover('adjust')"
                @mouseleave="hidePopover('adjust')"
              >
                <button class="icon-btn" data-tip="Adjustments">
                  <span v-html="icons.sliders" />
                </button>
                <div
                  class="popover popover-above"
                  :class="{ 'popover-open': openPopover === 'adjust' }"
                  @mouseenter="keepPopover('adjust')"
                  @mouseleave="hidePopover('adjust')"
                >
                  <div class="popover-inner">
                    <span class="popover-heading">Adjustments</span>
                    <label class="popover-field">
                      <span class="popover-label">Brightness {{ imageControls.brightness.toFixed(2) }}</span>
                      <input
                        :value="imageControls.brightness"
                        type="range" min="-1" max="1" step="0.01"
                        @input="onImageControlInput('brightness', $event.target.value)"
                        @change="commitImageControlChange"
                      />
                    </label>
                    <label class="popover-field">
                      <span class="popover-label">Contrast {{ Math.round(imageControls.contrast) }}</span>
                      <input
                        :value="imageControls.contrast"
                        type="range" min="-100" max="100" step="1"
                        @input="onImageControlInput('contrast', $event.target.value)"
                        @change="commitImageControlChange"
                      />
                    </label>
                    <label class="popover-field">
                      <span class="popover-label">Saturation {{ imageControls.saturation.toFixed(2) }}</span>
                      <input
                        :value="imageControls.saturation"
                        type="range" min="-2" max="2" step="0.01"
                        @input="onImageControlInput('saturation', $event.target.value)"
                        @change="commitImageControlChange"
                      />
                    </label>
                    <label class="popover-field">
                      <span class="popover-label">Hue {{ Math.round(imageControls.hue) }}deg</span>
                      <input
                        :value="imageControls.hue"
                        type="range" min="-180" max="180" step="1"
                        @input="onImageControlInput('hue', $event.target.value)"
                        @change="commitImageControlChange"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <button class="icon-btn" data-tip="Crop" @click="openCropperForSelectedImage">
                <span v-html="icons.crop" />
              </button>
              <button class="icon-btn" data-tip="Flip X" @click="flipSelectedImage('x')">
                <span v-html="icons.flipX" />
              </button>
              <button class="icon-btn" data-tip="Flip Y" @click="flipSelectedImage('y')">
                <span v-html="icons.flipY" />
              </button>
            </template>

            <!-- Text settings -->
            <template v-if="selectedText">
              <div
                class="popover-anchor popover-anchor-left"
                @mouseenter="showPopover('textedit')"
                @mouseleave="hidePopover('textedit')"
              >
                <button class="icon-btn" data-tip="Edit text">
                  <span v-html="icons.text" />
                </button>
                <div
                  class="popover popover-above popover-wide"
                  :class="{ 'popover-open': openPopover === 'textedit' }"
                  @mouseenter="keepPopover('textedit')"
                  @mouseleave="hidePopover('textedit')"
                >
                  <div class="popover-inner">
                    <span class="popover-heading">Text</span>
                    <label class="popover-field">
                      <textarea
                        :value="selectedText.text"
                        rows="3"
                        @input="updateTextContent($event.target.value)"
                        @change="commitTextChange"
                        @blur="commitTextChange"
                      />
                    </label>
                    <label class="popover-field">
                      <span class="popover-label">Size: {{ selectedText.fontSize }}px</span>
                      <input
                        :value="selectedText.fontSize"
                        type="range" min="10" max="160" step="1"
                        @input="updateTextSize($event.target.value)"
                        @change="commitTextChange"
                      />
                    </label>
                    <label class="popover-field">
                      <span class="popover-label">Color</span>
                      <input
                        :value="selectedText.fill"
                        type="color"
                        class="color-swatch"
                        @input="updateTextColor($event.target.value)"
                        @change="commitTextChange"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="stage-shell">
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

              <v-group
                v-for="block in renderImageBlocks"
                :key="block.id"
                :config="getImageBlockGroupConfig(block)"
                @click="selectBlock(block.id)"
                @tap="selectBlock(block.id)"
                @dragend="onBlockDragEnd(block, $event)"
                @transformend="onBlockTransformEnd(block, $event)"
              >
                <v-image :config="getImageNodeConfig(block)" />

                <v-group v-if="block.lines.length > 0" :config="getImageLineClipConfig(block)">
                  <v-line
                    v-for="line in block.lines"
                    :key="`${block.id}-${line.id}`"
                    :config="getLineNodeConfig(line)"
                  />
                </v-group>

                <v-rect :config="getImageFrameConfig(block)" />
              </v-group>

              <v-text
                v-for="block in renderTextBlocks"
                :key="block.id"
                :config="getTextNodeConfig(block)"
                @click="selectBlock(block.id)"
                @tap="selectBlock(block.id)"
                @dragend="onBlockDragEnd(block, $event)"
                @transformend="onBlockTransformEnd(block, $event)"
              />

              <v-transformer ref="transformerRef" :config="transformerConfig" />
            </v-layer>
          </v-stage>
        </div>
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
      ref="replaceImageInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onReplaceImageInputChange"
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
          <h2>Crop</h2>
          <button class="icon-btn" @click="closeCropper(true)">
            <span v-html="icons.close" />
          </button>
        </div>

        <div class="cropper-content">
          <div class="crop-preview-wrap">
            <canvas ref="cropPreviewRef" class="crop-preview" />
            <p>
              {{ cropper.sourceWidth }}x{{ cropper.sourceHeight }} -> {{ cropper.outputWidth }}x{{ cropper.outputHeight }}
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
              Width
              <input v-model.number="cropper.cropWidth" type="number" min="1" @input="renderCropPreview" />
            </label>
            <label>
              Height
              <input v-model.number="cropper.cropHeight" type="number" min="1" @input="renderCropPreview" />
            </label>
            <label>
              Out W
              <input v-model.number="cropper.outputWidth" type="number" min="1" max="4096" @input="renderCropPreview" />
            </label>
            <label>
              Out H
              <input v-model.number="cropper.outputHeight" type="number" min="1" max="4096" @input="renderCropPreview" />
            </label>
            <label>
              Rotation
              <input v-model.number="cropper.rotation" type="range" min="-180" max="180" step="1" @input="renderCropPreview" />
              <span>{{ Math.round(cropper.rotation) }}deg</span>
            </label>

            <div class="tool-row">
              <button class="mini-btn" @click="setCropFullImage">
                <span v-html="icons.fullImage" /> Full
              </button>
              <button class="mini-btn" @click="setCropSquareCenter">
                <span v-html="icons.squareCenter" /> Square
              </button>
            </div>

            <div class="tool-row">
              <button class="mini-btn accent" @click="applyCropper">
                <span v-html="icons.check" /> Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p v-if="notice" class="notice">{{ notice }}</p>
  </div>
</template>

<style scoped src="./styles/app-editor.css"></style>
