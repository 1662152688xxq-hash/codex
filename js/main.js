/**
 * 主入口 - 3D 地形图生成器
 * 协调 UI 控制、地形生成、3D 渲染和导出
 */

import { TerrainRenderer } from './renderer.js';
import { generateProceduralHeightmap, generateFromImage, getStats } from './terrain.js';
import { exportSTL_ASCII, exportSTL_Binary, exportOBJ, downloadText, downloadBlob, getExportFilename } from './export.js';

// ============================================
// 全局状态
// ============================================
let renderer = null;
let currentHeightmap = null;
let currentMode = 'procedural';  // 'procedural' | 'image'
let loadedImage = null;

// ============================================
// DOM 引用
// ============================================
const $ = id => document.getElementById(id);

const dom = {
    loading: $('loading'),
    errorToast: $('error-toast'),
    container: $('canvas-container'),

    // 参数
    size: $('size'),
    sizeVal: $('size-val'),
    resolution: $('resolution'),
    resolutionVal: $('resolution-val'),
    height: $('height'),
    heightVal: $('height-val'),
    scale: $('scale'),
    scaleVal: $('scale-val'),
    octaves: $('octaves'),
    octavesVal: $('octaves-val'),
    persistence: $('persistence'),
    persistenceVal: $('persistence-val'),
    lacunarity: $('lacunarity'),
    lacunarityVal: $('lacunarity-val'),
    seed: $('seed'),
    seedVal: $('seed-val'),

    // 图片参数
    fileInput: $('file-input'),
    dropZone: $('drop-zone'),
    preview: $('preview'),
    imgHeight: $('img-height'),
    imgHeightVal: $('img-height-val'),

    // 颜色
    colorScheme: $('color-scheme'),
    customColors: $('custom-colors'),
    colorLow: $('color-low'),
    colorMid: $('color-mid'),
    colorHigh: $('color-high'),

    // 显示选项
    showWireframe: $('show-wireframe'),
    showGrid: $('show-grid'),
    autoRotate: $('auto-rotate'),

    // 信息
    infoVertices: $('info-vertices'),
    infoFaces: $('info-faces'),
    infoHeight: $('info-height'),
    infoFps: $('info-fps'),
    coordDisplay: $('coord-display'),

    // 生成按钮
    generateBtn: $('generate-btn'),
};

// ============================================
// FPS 计数器
// ============================================
let frameCount = 0;
let lastFpsUpdate = performance.now();

function updateFPS() {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdate >= 1000) {
        dom.infoFps.textContent = `FPS: ${frameCount}`;
        frameCount = 0;
        lastFpsUpdate = now;
    }
    requestAnimationFrame(updateFPS);
}

// ============================================
// 工具函数
// ============================================

function showError(msg) {
    dom.errorToast.textContent = msg;
    dom.errorToast.classList.remove('hidden');
    setTimeout(() => dom.errorToast.classList.add('hidden'), 4000);
}

function debounce(fn, ms = 200) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

// ============================================
// 模式切换
// ============================================

window.switchMode = function(mode) {
    currentMode = mode;
    document.querySelectorAll('.btn-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    document.getElementById('procedural-params').classList.toggle('hidden', mode !== 'procedural');
    document.getElementById('image-params').classList.toggle('hidden', mode !== 'image');
};

// ============================================
// 参数同步（滑块 ↔ 显示值）
// ============================================

function setupSliders() {
    const bindings = [
        { el: dom.size, val: dom.sizeVal, format: v => v },
        { el: dom.resolution, val: dom.resolutionVal, format: v => v },
        { el: dom.height, val: dom.heightVal, format: v => v },
        { el: dom.scale, val: dom.scaleVal, format: v => parseFloat(v).toFixed(3) },
        { el: dom.octaves, val: dom.octavesVal, format: v => v },
        { el: dom.persistence, val: dom.persistenceVal, format: v => parseFloat(v).toFixed(2) },
        { el: dom.lacunarity, val: dom.lacunarityVal, format: v => parseFloat(v).toFixed(1) },
        { el: dom.seed, val: dom.seedVal, format: v => v },
        { el: dom.imgHeight, val: dom.imgHeightVal, format: v => v },
    ];

    bindings.forEach(({ el, val, format }) => {
        el.addEventListener('input', () => {
            val.textContent = format(el.value);
        });
    });
}

// ============================================
// 预设
// ============================================

const PRESETS = {
    mountain: { size: 100, height: 35, scale: 0.025, octaves: 8, persistence: 0.6, lacunarity: 2.2, seed: 42 },
    hills: { size: 100, height: 15, scale: 0.04, octaves: 5, persistence: 0.45, lacunarity: 2.0, seed: 42 },
    plain: { size: 100, height: 6, scale: 0.02, octaves: 3, persistence: 0.4, lacunarity: 1.8, seed: 42 },
    canyon: { size: 100, height: 30, scale: 0.035, octaves: 7, persistence: 0.55, lacunarity: 2.5, seed: 42 },
};

window.applyPreset = function(name) {
    const p = PRESETS[name];
    if (!p) return;
    dom.size.value = p.size;
    dom.sizeVal.textContent = p.size;
    dom.height.value = p.height;
    dom.heightVal.textContent = p.height;
    dom.scale.value = p.scale;
    dom.scaleVal.textContent = p.scale.toFixed(3);
    dom.octaves.value = p.octaves;
    dom.octavesVal.textContent = p.octaves;
    dom.persistence.value = p.persistence;
    dom.persistenceVal.textContent = p.persistence.toFixed(2);
    dom.lacunarity.value = p.lacunarity;
    dom.lacunarityVal.textContent = p.lacunarity.toFixed(1);
    dom.seed.value = p.seed;
    dom.seedVal.textContent = p.seed;
    generate();
};

// ============================================
// 颜色方案
// ============================================

dom.colorScheme.addEventListener('change', () => {
    const scheme = dom.colorScheme.value;
    dom.customColors.classList.toggle('hidden', scheme !== 'custom');
    if (currentHeightmap && renderer) {
        if (scheme === 'custom') {
            renderer.customColors = getCustomColorStops();
        }
        renderer.colorScheme = scheme;
        renderer.updateColors(currentHeightmap);
    }
});

function getCustomColorStops() {
    return [
        { stop: 0.0, color: new THREE.Color(dom.colorLow.value) },
        { stop: 0.5, color: new THREE.Color(dom.colorMid.value) },
        { stop: 1.0, color: new THREE.Color(dom.colorHigh.value) },
    ];
}

[dom.colorLow, dom.colorMid, dom.colorHigh].forEach(input => {
    input.addEventListener('input', () => {
        if (currentHeightmap && renderer && dom.colorScheme.value === 'custom') {
            renderer.customColors = getCustomColorStops();
            renderer.updateColors(currentHeightmap);
        }
    });
});

// ============================================
// 显示选项
// ============================================

dom.showWireframe.addEventListener('change', () => {
    if (renderer) renderer.setWireframe(dom.showWireframe.checked);
});

dom.showGrid.addEventListener('change', () => {
    if (renderer) renderer.setGrid(dom.showGrid.checked);
});

dom.autoRotate.addEventListener('change', () => {
    if (renderer) renderer.setAutoRotate(dom.autoRotate.checked);
});

// ============================================
// 图片上传
// ============================================

dom.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
        loadedImage = img;
        dom.preview.src = img.src;
        dom.preview.classList.remove('hidden');
        dom.dropZone.querySelector('.upload-prompt').classList.add('hidden');
        generate();
    };
    img.onerror = () => showError('图片加载失败，请检查文件格式');
    img.src = URL.createObjectURL(file);
});

// 拖拽上传
dom.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.dropZone.classList.add('dragover');
});

dom.dropZone.addEventListener('dragleave', () => {
    dom.dropZone.classList.remove('dragover');
});

dom.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        dom.fileInput.files = e.dataTransfer.files;
        dom.fileInput.dispatchEvent(new Event('change'));
    }
});

// ============================================
// 鼠标交互
// ============================================

let mouseMoveTimer = null;
dom.container.addEventListener('mousemove', (e) => {
    if (!renderer) return;
    clearTimeout(mouseMoveTimer);
    mouseMoveTimer = setTimeout(() => {
        const point = renderer.raycast(e.clientX, e.clientY);
        if (point) {
            dom.coordDisplay.textContent = `X: ${point.x} Y: ${point.y} Z: ${point.z}`;
        } else {
            dom.coordDisplay.textContent = '—';
        }
    }, 50);
});

// ============================================
// 核心生成函数
// ============================================

window.generate = async function() {
    dom.generateBtn.disabled = true;
    dom.generateBtn.textContent = '⏳ 生成中...';

    try {
        let heightmapData;

        if (currentMode === 'procedural') {
            const params = {
                width: parseInt(dom.resolution.value),
                height: parseInt(dom.resolution.value),
                scale: parseFloat(dom.scale.value),
                octaves: parseInt(dom.octaves.value),
                persistence: parseFloat(dom.persistence.value),
                lacunarity: parseFloat(dom.lacunarity.value),
                heightScale: parseFloat(dom.height.value),
                seed: parseInt(dom.seed.value)
            };

            heightmapData = generateProceduralHeightmap(params);

        } else {
            // 图片模式
            if (!loadedImage) {
                showError('请先上传一张高度图图片');
                dom.generateBtn.disabled = false;
                dom.generateBtn.textContent = '🔄 生成地形';
                return;
            }

            const targetSize = Math.min(512, parseInt(dom.resolution.value) || 256);
            heightmapData = generateFromImage(loadedImage, {
                heightScale: parseFloat(dom.imgHeight.value),
                targetSize
            });
        }

        currentHeightmap = heightmapData;

        // 生成 3D 网格
        const geoData = renderer.buildTerrain(
            heightmapData,
            dom.showWireframe.checked && heightmapData.width <= 256
        );

        // 更新信息
        const stats = getStats(heightmapData);
        dom.infoVertices.textContent = `顶点: ${stats.vertices.toLocaleString()}`;
        dom.infoFaces.textContent = `面: ${stats.faces.toLocaleString()}`;
        dom.infoHeight.textContent = `最高: ${stats.maxHeight.toFixed(2)}`;

        // 同步颜色方案
        const scheme = dom.colorScheme.value;
        if (scheme === 'custom') {
            renderer.customColors = getCustomColorStops();
        }
        renderer.colorScheme = scheme;

    } catch (err) {
        showError(`生成失败: ${err.message}`);
        console.error(err);
    }

    dom.generateBtn.disabled = false;
    dom.generateBtn.textContent = '🔄 生成地形';
};

// ============================================
// 导出功能
// ============================================

window.exportSTL = function() {
    if (!currentHeightmap) {
        showError('请先生成地形');
        return;
    }

    try {
        // 大模型用 Binary，小模型用 ASCII
        const vertexCount = currentHeightmap.width * currentHeightmap.height;
        if (vertexCount > 10000) {
            const blob = exportSTL_Binary(currentHeightmap);
            downloadBlob(blob, getExportFilename('terrain', 'stl'));
        } else {
            const text = exportSTL_ASCII(currentHeightmap);
            downloadText(text, getExportFilename('terrain', 'stl'));
        }
    } catch (err) {
        showError(`STL 导出失败: ${err.message}`);
    }
};

window.exportOBJ = function() {
    if (!currentHeightmap) {
        showError('请先生成地形');
        return;
    }

    try {
        const text = exportOBJ(currentHeightmap);
        downloadText(text, getExportFilename('terrain', 'obj'));
    } catch (err) {
        showError(`OBJ 导出失败: ${err.message}`);
    }
};

window.screenshot = function() {
    if (!renderer) {
        showError('请先生成地形');
        return;
    }
    renderer.screenshot();
};

// ============================================
// 关于弹窗
// ============================================

window.showAbout = function() {
    document.getElementById('about-modal').classList.remove('hidden');
};

window.closeAbout = function() {
    document.getElementById('about-modal').classList.add('hidden');
};

// 点击模态框外部关闭
document.getElementById('about-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAbout();
});

// ============================================
// 键盘快捷键
// ============================================

document.addEventListener('keydown', (e) => {
    // Ctrl+Enter 生成地形
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        generate();
    }
    // Escape 关闭模态框
    if (e.key === 'Escape') {
        closeAbout();
    }
    // Ctrl+S 截图
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        screenshot();
    }
});

// ============================================
// 初始化
// ============================================

async function init() {
    try {
        // 设置滑块
        setupSliders();

        // 设置生成按钮的防抖（高频参数调整时延迟生成）
        const debouncedGenerate = debounce(generate, 300);
        document.querySelectorAll('#procedural-params input[type="range"]').forEach(el => {
            el.addEventListener('change', generate);
            // 实时预览使用 debounce
            el.addEventListener('input', debouncedGenerate);
        });

        // 初始化渲染器
        renderer = new TerrainRenderer(dom.container);
        renderer.setAutoRotate(true);

        // 启动 FPS 监控
        updateFPS();

        // 隐藏加载
        dom.loading.classList.add('hidden');

        // 生成初始地形
        generate();

    } catch (err) {
        showError(`初始化失败: ${err.message}`);
        console.error(err);
        dom.loading.classList.add('hidden');
    }
}

// DOM 加载完成后启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
