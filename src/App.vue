<script setup>
import { useImageEditor } from './composables/useImageEditor'

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
} = useImageEditor()
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="title-wrap">
        <h1>Konva Image Editor Demo</h1>
        <p>MVP: upload, crop/resize/rotate, filters, draw/erase, text, eyedropper, undo/redo(5), export.</p>
        <div class="status-row">
          <span class="status-pill">Tool: {{ activeToolLabel }}</span>
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
        <button class="btn-primary" @click="addDefaultBlock">Add block</button>
        <button class="btn-soft" @click="triggerImagePicker">Upload image(s)</button>
        <button class="btn-soft" :disabled="!selectedImage" @click="triggerReplaceImagePicker">Replace image</button>
        <button class="btn-soft" @click="addSampleImageBlock">Add sample</button>
        <button class="btn-soft" @click="addTextBlock">Add text</button>
        <button class="btn-soft" :disabled="!selectedImage" @click="duplicateSelectedBlock">Duplicate block</button>
        <button class="btn-soft" @click="zoomOut">Zoom -</button>
        <button class="btn-soft" @click="zoomIn">Zoom +</button>
        <button class="btn-soft" :disabled="!canUndo" @click="undo">Undo</button>
        <button class="btn-soft" :disabled="!canRedo" @click="redo">Redo</button>
      </div>
    </header>

    <div class="workspace">
      <aside class="panel">
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

        <section>
          <h2>Workspace</h2>
          <p class="muted">Editing tools and selected block settings are local in the canvas card.</p>
          <p class="muted">Undo/redo now works per selected image block, including draw/edit actions in that block.</p>
          <p class="muted">Add block creates a separate image block. Replace image updates only selected block content.</p>
        </section>
      </aside>

      <div ref="canvasWrapRef" class="canvas-wrap">
        <div class="preview-card">
          <div class="preview-head">
            <h2>Canvas</h2>
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
                  v-for="block in imageBlocks"
                  :key="block.id"
                  :config="getImageBlockGroupConfig(block)"
                  @click="selectBlock(block.id)"
                  @tap="selectBlock(block.id)"
                  @dragend="onBlockDragEnd(block, $event)"
                  @transformend="onBlockTransformEnd(block, $event)"
                >
                  <v-image :config="getImageNodeConfig(block)" />

                  <v-group :config="getImageLineClipConfig(block)">
                    <v-line
                      v-for="line in block.lines"
                      :key="`${block.id}-${line.id}`"
                      :config="getLineNodeConfig(line)"
                    />
                  </v-group>

                  <v-rect :config="getImageFrameConfig(block)" />
                </v-group>

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
            </v-stage>
          </div>

          <div class="card-controls">
            <div class="tool-row card-tool-row">
              <button class="quick-btn" :class="{ active: !panMode && tool === 'select' }" @click="setTool('select')">Select</button>
              <button class="quick-btn" :class="{ active: !panMode && tool === 'pen' }" @click="setTool('pen')">Brush</button>
              <button class="quick-btn" :class="{ active: !panMode && tool === 'erase' }" @click="setTool('erase')">Eraser</button>
              <button class="quick-btn" :class="{ active: panMode }" @click="togglePanMode">Pan canvas</button>
            </div>

            <div class="card-grid">
              <section v-if="!panMode && tool === 'pen'" class="card-section">
                <h3>Brush</h3>
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

              <section v-if="!panMode && tool === 'erase'" class="card-section">
                <h3>Eraser</h3>
                <div class="field-grid">
                  <label>
                    Eraser size
                    <input v-model.number="eraserSize" type="range" min="2" max="80" step="1" />
                    <span>{{ eraserSize }} px</span>
                  </label>
                  <p class="muted">Eraser is a separate tool with independent size settings.</p>
                </div>
              </section>

              <section v-if="selectedImage" class="card-section">
                <h3>Selected image</h3>
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
                    <button @click="openCropperForSelectedImage">Crop selected</button>
                  </div>
                </div>
              </section>

              <section v-if="selectedText" class="card-section">
                <h3>Selected text</h3>
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
              </section>

              <p v-if="!selectedImage && !selectedText && !panMode && tool === 'select'" class="card-empty">
                Select an image or text block to open local settings.
              </p>
            </div>
          </div>

          <div class="quick-dock">
            <button class="quick-btn" :disabled="!selectedBlock" @click="rotateSelectedBy(15)">Rotate</button>
            <button class="quick-btn" :disabled="!selectedBlock" @click="focusSelectedBlock">Center</button>
            <button class="quick-btn" :disabled="!canUndo" @click="undo">Undo</button>
            <button class="quick-btn" :disabled="!canRedo" @click="redo">Redo</button>
            <button class="quick-btn" @click="resetStageView">Reset view</button>
            <button class="quick-btn" :disabled="!selectedBlock" @click="resetSelectedBlockState">Reset selected</button>
            <button class="quick-btn danger" :disabled="!selectedBlock" @click="removeSelectedBlock">Delete</button>
          </div>
        </div>

        <p class="canvas-hint">
          Wheel = zoom. Select = move whole block. Use Replace image to update content inside selected block. Undo/redo applies to
          selected image block.
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

<style scoped src="./styles/app-editor.css"></style>
