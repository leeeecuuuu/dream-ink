/**
 * mask-editor.js — 蒙版编辑器
 *
 * 处理图片涂抹、橡皮擦，生成 Base64 黑白蒙版供重绘使用
 */

import { $, compressImageDataUrl } from '../utils/helpers.js';
import { state } from '../state/app-state.js';
import { showToast } from './toast.js';
import { bus } from '../utils/event-bus.js';

export function initMaskEditor() {
    const modal = $('maskEditorModal');
    const bgCanvas = $('maskImageCanvas');
    const drawCanvas = $('maskDrawCanvas');
    const wrapper = $('maskCanvasWrapper');
    const container = $('maskCanvasContainer');
    if (!modal || !bgCanvas || !drawCanvas) return;

    const bgCtx = bgCanvas.getContext('2d');
    const drawCtx = drawCanvas.getContext('2d');
    
    let isDrawing = false;
    let brushSize = parseInt($('maskBrushSize').value, 10);
    let mode = 'draw'; // draw | erase
    let currentImageIndex = -1;

    // UI Elements
    const brushSizeSlider = $('maskBrushSize');
    const brushSizeVal = $('maskBrushSizeVal');
    const clearBtn = $('maskClearBtn');
    const saveBtn = $('maskSaveBtn');
    const closeBtn = $('maskCloseBtn');

    brushSizeSlider.oninput = (e) => {
        brushSize = parseInt(e.target.value, 10);
        brushSizeVal.textContent = brushSize + 'px';
    };

    document.querySelectorAll('input[name="maskMode"]').forEach(radio => {
        radio.onchange = (e) => {
            mode = e.target.value;
        };
    });

    clearBtn.onclick = () => {
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    };

    closeBtn.onclick = () => {
        modal.style.display = 'none';
        currentImageIndex = -1;
    };

    // Initialize state masks array if it doesn't exist
    if (!state.selectedMasks) {
        state.selectedMasks = [];
    }

    saveBtn.onclick = () => {
        if (currentImageIndex === -1) return;

        // Generate mask: non-transparent pixels become white, transparent become black
        // Wait, standard OpenAI mask: transparent areas = where to edit, non-transparent = where to keep.
        // Wait, the documentation says: "The mask image must be a PNG. Fully transparent areas indicate where the image should be edited, while fully opaque areas indicate where it should not be edited."
        // Or in DALL-E, white/black or transparency?
        // Let's create a transparent PNG where the drawn areas are fully transparent, and the rest is fully opaque.
        // Wait, if the user "draws" over an object to remove it, they want to edit that part. So the drawn part should be transparent.

        const maskData = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
        const newCanvas = document.createElement('canvas');
        newCanvas.width = drawCanvas.width;
        newCanvas.height = drawCanvas.height;
        const newCtx = newCanvas.getContext('2d');
        const newData = newCtx.createImageData(drawCanvas.width, drawCanvas.height);

        for (let i = 0; i < maskData.data.length; i += 4) {
            const alpha = maskData.data[i + 3];
            if (alpha > 0) {
                // User painted here -> we want to edit here -> fully transparent
                newData.data[i] = 0;
                newData.data[i + 1] = 0;
                newData.data[i + 2] = 0;
                newData.data[i + 3] = 0;
            } else {
                // User didn't paint here -> keep original -> fully opaque
                newData.data[i] = 0;
                newData.data[i + 1] = 0;
                newData.data[i + 2] = 0;
                newData.data[i + 3] = 255;
            }
        }
        newCtx.putImageData(newData, 0, 0);
        
        state.selectedMasks[currentImageIndex] = newCanvas.toDataURL('image/png');
        modal.style.display = 'none';
        // 触发预览刷新，让垫图区显示蒙版叠加效果
        bus.emit('selectedFiles:change');
        showToast('蒙版已保存，在生成时将作为重绘参考 ✓');
    };

    function getMousePos(evt) {
        const rect = drawCanvas.getBoundingClientRect();
        const scaleX = drawCanvas.width / rect.width;
        const scaleY = drawCanvas.height / rect.height;
        return {
            x: (evt.clientX - rect.left) * scaleX,
            y: (evt.clientY - rect.top) * scaleY
        };
    }

    drawCanvas.onmousedown = (e) => {
        isDrawing = true;
        const pos = getMousePos(e);
        drawCtx.beginPath();
        drawCtx.moveTo(pos.x, pos.y);
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
    };

    drawCanvas.onmousemove = (e) => {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        drawCtx.lineTo(pos.x, pos.y);
        
        if (mode === 'draw') {
            drawCtx.globalCompositeOperation = 'source-over';
            drawCtx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // Red for masking
            drawCtx.lineWidth = brushSize;
            drawCtx.stroke();
        } else {
            drawCtx.globalCompositeOperation = 'destination-out';
            drawCtx.lineWidth = brushSize;
            drawCtx.stroke();
        }
    };

    drawCanvas.onmouseup = () => {
        isDrawing = false;
        drawCtx.closePath();
    };

    drawCanvas.onmouseleave = () => {
        isDrawing = false;
    };

    // Open function to be called from outside
    // imgSrc: data: URL or any image src
    // index: index in selectedFiles/selectedMasks
    // fromGallery: if true, store the image as selectedFiles[0] for generation
    window._openMaskEditor = (imgSrc, index, fromGallery) => {
        currentImageIndex = index;
        const img = new Image();
        img.onerror = () => {
            showToast('图片加载失败，无法打开蒙版编辑器', 'error');
        };
        img.onload = async () => {
            // If opened from gallery, store the image in state.selectedFiles as a File
            // We use canvas to export a safe base64 (avoids any cross-origin issues)
            if (fromGallery) {
                // Use a temp canvas to get clean base64
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.naturalWidth || img.width;
                tempCanvas.height = img.naturalHeight || img.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(img, 0, 0);
                const rawDataUrl = tempCanvas.toDataURL('image/png');
                let b64DataUrl = rawDataUrl;
                try {
                    const compressed = await compressImageDataUrl(rawDataUrl);
                    b64DataUrl = compressed.dataUrl;
                    if (compressed.compressed) {
                        showToast(`重绘底图已自动压缩至 ${compressed.width}x${compressed.height}`);
                    }
                } catch (e) {
                    console.warn('重绘底图压缩失败，使用原图', e);
                }
                // Convert to File and store in state
                const byteStr = atob(b64DataUrl.split(',')[1]);
                const mimeStr = b64DataUrl.split(',')[0].match(/:(.*?);/)[1];
                const ab = new ArrayBuffer(byteStr.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
                const file = new File([ab], 'redraw.png', { type: mimeStr });
                state.selectedFiles = [file];
                bus.emit('selectedFiles:change');
            }

            // Resize logic to fit container
            const maxW = window.innerWidth * 0.9;
            const maxH = window.innerHeight * 0.7;
            let drawW = img.naturalWidth || img.width;
            let drawH = img.naturalHeight || img.height;

            if (drawW > maxW || drawH > maxH) {
                const ratio = Math.min(maxW / drawW, maxH / drawH);
                drawW = Math.round(drawW * ratio);
                drawH = Math.round(drawH * ratio);
            }

            bgCanvas.width = img.naturalWidth || img.width;
            bgCanvas.height = img.naturalHeight || img.height;
            drawCanvas.width = bgCanvas.width;
            drawCanvas.height = bgCanvas.height;
            
            wrapper.style.width = drawW + 'px';
            wrapper.style.height = drawH + 'px';

            // 关键：让 canvas 的 CSS 尺寸跟随 wrapper，
            // 而内部像素尺寸保持原图分辨率（用于高质量蒙版导出）
            bgCanvas.style.width = '100%';
            bgCanvas.style.height = '100%';
            drawCanvas.style.width = '100%';
            drawCanvas.style.height = '100%';

            bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
            bgCtx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);

            // Init draw canvas
            drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

            // Load existing mask if available
            if (state.selectedMasks && state.selectedMasks[index]) {
                const existingMask = new Image();
                existingMask.onload = () => {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = bgCanvas.width;
                    tempCanvas.height = bgCanvas.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(existingMask, 0, 0);
                    const maskData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    
                    const drawData = drawCtx.createImageData(drawCanvas.width, drawCanvas.height);
                    for (let i = 0; i < maskData.data.length; i += 4) {
                        const alpha = maskData.data[i + 3];
                        if (alpha === 0) {
                            // Was marked for editing -> draw red
                            drawData.data[i] = 255;
                            drawData.data[i + 1] = 0;
                            drawData.data[i + 2] = 0;
                            drawData.data[i + 3] = 204; // 80% opacity
                        }
                    }
                    drawCtx.putImageData(drawData, 0, 0);
                };
                existingMask.src = state.selectedMasks[index];
            }

            modal.style.display = 'flex';
        };
        // Support data: URLs, blob: URLs, and regular URLs
        img.crossOrigin = 'anonymous';
        img.src = imgSrc;
    };
}
