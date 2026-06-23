/**
 * 地形生成引擎
 * - 程序化生成（FBM - 分形布朗运动）
 * - 图片高度图加载
 * - 地形数据操作
 */

import { PerlinNoise, SimplexNoise } from './noise.js';

/**
 * 使用 FBM（分形布朗运动）生成高度图
 */
export function generateProceduralHeightmap(params) {
    const {
        width = 128,
        height = 128,
        scale = 0.03,
        octaves = 6,
        persistence = 0.5,
        lacunarity = 2.0,
        heightScale = 20,
        seed = 42,
        noiseType = 'perlin'
    } = params;

    const noise = noiseType === 'simplex'
        ? new SimplexNoise(seed)
        : new PerlinNoise(seed);

    const heightmap = new Float32Array(width * height);

    // 归一化范围跟踪
    let minVal = Infinity, maxVal = -Infinity;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let amp = 1.0;
            let freq = 1.0;
            let total = 0;
            let maxAmp = 0;

            for (let i = 0; i < octaves; i++) {
                const nx = (x - width / 2) * scale * freq;
                const ny = (y - height / 2) * scale * freq;
                let val = noise.noise2D(nx, ny);
                total += val * amp;
                maxAmp += amp;
                amp *= persistence;
                freq *= lacunarity;
            }

            // 归一化到 [0, 1]
            const normalized = (total / maxAmp + 1) / 2;
            const clamped = Math.max(0, Math.min(1, normalized));

            // 应用边缘衰减（圆形遮罩，避免接缝突兀）
            const dx = (x / width - 0.5) * 2;
            const dy = (y / height - 0.5) * 2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const fade = 1 - Math.pow(Math.max(0, dist - 0.3) / 0.7, 2);

            const final = clamped * Math.max(0, fade);

            heightmap[y * width + x] = final;
            if (final < minVal) minVal = final;
            if (final > maxVal) maxVal = final;
        }
    }

    return {
        data: heightmap,
        width,
        height,
        minVal,
        maxVal,
        heightScale
    };
}

/**
 * 从图片生成高度图
 */
export function generateFromImage(imageData, params) {
    const { heightScale = 30, targetSize = 256 } = params;
    const img = imageData;

    // 缩放图片到目标大小
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, targetSize, targetSize);

    const imageData_ = ctx.getImageData(0, 0, targetSize, targetSize);
    const pixels = imageData_.data;

    const size = targetSize;
    const heightmap = new Float32Array(size * size);
    let minVal = Infinity, maxVal = -Infinity;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            // 灰度值 (使用 luminance 权重)
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const normalized = gray / 255;

            heightmap[y * size + x] = normalized;
            if (normalized < minVal) minVal = normalized;
            if (normalized > maxVal) maxVal = normalized;
        }
    }

    return {
        data: heightmap,
        width: size,
        height: size,
        minVal,
        maxVal,
        heightScale
    };
}

/**
 * 在地形上采样高度
 */
export function sampleHeight(heightmap, width, height, x, z) {
    // 双线性插值
    const fx = ((x + 1) / 2) * (width - 1);
    const fz = ((z + 1) / 2) * (height - 1);
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const dx = fx - ix;
    const dz = fz - iz;

    const ix1 = Math.min(ix + 1, width - 1);
    const iz1 = Math.min(iz + 1, height - 1);

    const h00 = heightmap[iz * width + ix];
    const h10 = heightmap[iz * width + ix1];
    const h01 = heightmap[iz1 * width + ix];
    const h11 = heightmap[iz1 * width + ix1];

    return h00 * (1 - dx) * (1 - dz) + h10 * dx * (1 - dz) + h01 * (1 - dx) * dz + h11 * dx * dz;
}

/**
 * 将高度图转换为三维顶点数据
 */
export function heightmapToGeometry(heightmapData) {
    const { data, width, height, heightScale } = heightmapData;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    // 地形物理尺寸
    const size = Math.min(width, height);

    for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
            const h = data[z * width + x];
            const y = (h - 0.5) * heightScale;

            // 位置: 居中
            const px = (x / (width - 1) - 0.5) * size;
            const pz = (z / (height - 1) - 0.5) * size;
            positions.push(px, y, pz);

            // UV
            uvs.push(x / (width - 1), z / (height - 1));

            // 法线占位
            normals.push(0, 1, 0);
        }
    }

    // 索引（三角形网格）
    for (let z = 0; z < height - 1; z++) {
        for (let x = 0; x < width - 1; x++) {
            const a = z * width + x;
            const b = z * width + x + 1;
            const c = (z + 1) * width + x;
            const d = (z + 1) * width + x + 1;

            // 两个三角形构成一个网格单元
            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }

    // 计算法线
    computeNormals(positions, indices, normals);

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        indices: new Uint16Array(indices),
        vertexCount: positions.length / 3,
        faceCount: indices.length / 3
    };
}

/**
 * 计算法线
 */
function computeNormals(positions, indices, normals) {
    // 先重置法线
    for (let i = 0; i < normals.length; i++) normals[i] = 0;

    for (let i = 0; i < indices.length; i += 3) {
        const ia = indices[i] * 3;
        const ib = indices[i + 1] * 3;
        const ic = indices[i + 2] * 3;

        const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
        const bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
        const cx = positions[ic], cy = positions[ic + 1], cz = positions[ic + 2];

        // 边向量
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;

        // 叉积
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;

        // 归一化
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 0) { nx /= len; ny /= len; nz /= len; }

        // 累加到顶点法线
        normals[ia] += nx; normals[ia + 1] += ny; normals[ia + 2] += nz;
        normals[ib] += nx; normals[ib + 1] += ny; normals[ib + 2] += nz;
        normals[ic] += nx; normals[ic + 1] += ny; normals[ic + 2] += nz;
    }

    // 归一化顶点法线
    for (let i = 0; i < normals.length; i += 3) {
        const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 0) {
            normals[i] /= len;
            normals[i + 1] /= len;
            normals[i + 2] /= len;
        }
    }
}

/**
 * 应用侵蚀效果（简化热力侵蚀）
 */
export function applyErosion(heightmapData, iterations = 1) {
    const { data, width, height } = heightmapData;
    const result = new Float32Array(data);
    const temp = new Float32Array(data);
    const K = 0.1; // 侵蚀率

    for (let iter = 0; iter < iterations; iter++) {
        for (let z = 1; z < height - 1; z++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = z * width + x;
                const h = temp[idx];

                // 计算相邻最高差
                let maxDiff = 0;
                const neighbors = [
                    temp[(z - 1) * width + x],     // 上
                    temp[(z + 1) * width + x],     // 下
                    temp[z * width + (x - 1)],     // 左
                    temp[z * width + (x + 1)]      // 右
                ];

                for (const n of neighbors) {
                    const diff = h - n;
                    if (diff > maxDiff) maxDiff = diff;
                }

                // 沉积 / 侵蚀
                if (maxDiff > 0.01) {
                    const transfer = maxDiff * K;
                    result[idx] -= transfer;

                    // 将侵蚀量均匀分配到相邻较低点
                    let count = 0;
                    for (const n of neighbors) {
                        if (h - n > 0) count++;
                    }
                    if (count > 0) {
                        const idxs = [
                            (z - 1) * width + x,
                            (z + 1) * width + x,
                            z * width + (x - 1),
                            z * width + (x + 1)
                        ];
                        for (let i = 0; i < 4; i++) {
                            if (h - neighbors[i] > 0) {
                                result[idxs[i]] += transfer / count;
                            }
                        }
                    }
                }
            }
        }
        // 交换 Buffer
        for (let i = 0; i < result.length; i++) {
            temp[i] = result[i];
        }
    }

    return {
        ...heightmapData,
        data: result
    };
}

/**
 * 获取地形统计信息
 */
export function getStats(heightmapData) {
    const { data, width, height, heightScale } = heightmapData;
    let min = Infinity, max = -Infinity, sum = 0;
    for (const v of data) {
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
    }
    const avg = sum / data.length;

    return {
        vertices: width * height,
        faces: (width - 1) * (height - 1) * 2,
        minHeight: (min - 0.5) * heightScale,
        maxHeight: (max - 0.5) * heightScale,
        avgHeight: (avg - 0.5) * heightScale,
        resolution: `${width}×${height}`
    };
}
