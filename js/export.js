/**
 * 模型导出模块
 * - STL (ASCII + Binary)
 * - OBJ
 */

import { heightmapToGeometry } from './terrain.js';

/**
 * 导出 STL 格式（ASCII）
 */
export function exportSTL_ASCII(heightmapData, name = 'terrain') {
    const geoData = heightmapToGeometry(heightmapData);
    const { positions, normals, indices } = geoData;

    let header = `solid ${name}\n`;

    for (let i = 0; i < indices.length; i += 3) {
        const ia = indices[i] * 3;
        const ib = indices[i + 1] * 3;
        const ic = indices[i + 2] * 3;

        // 取第一个顶点的法线（STL 使用面法线，但这里用顶点法线近似）
        const nx = normals[ia].toFixed(6);
        const ny = normals[ia + 1].toFixed(6);
        const nz = normals[ia + 2].toFixed(6);

        header += `  facet normal ${nx} ${ny} ${nz}\n`;
        header += `    outer loop\n`;

        [ia, ib, ic].forEach(idx => {
            const x = positions[idx].toFixed(6);
            const y = positions[idx + 1].toFixed(6);
            const z = positions[idx + 2].toFixed(6);
            header += `      vertex ${x} ${y} ${z}\n`;
        });

        header += `    endloop\n`;
        header += `  endfacet\n`;
    }

    header += `endsolid ${name}\n`;
    return header;
}

/**
 * 导出 STL 格式（Binary）
 * 文件更小，适合3D打印
 */
export function exportSTL_Binary(heightmapData) {
    const geoData = heightmapToGeometry(heightmapData);
    const { positions, normals, indices, faceCount } = geoData;

    const header = new ArrayBuffer(80);
    const headerView = new Uint8Array(header);
    const text = '3D Terrain Generator - STL Binary Export';
    for (let i = 0; i < text.length && i < 80; i++) {
        headerView[i] = text.charCodeAt(i);
    }

    // 4字节面数 + 每个面 50 字节
    const bufferSize = 84 + faceCount * 50;
    const buffer = new ArrayBuffer(bufferSize);
    const dv = new DataView(buffer);

    // 复制 header
    new Uint8Array(buffer, 0, 80).set(headerView);

    // 面数
    dv.setUint32(80, faceCount, true);

    let offset = 84;
    for (let i = 0; i < indices.length; i += 3) {
        const ia = indices[i] * 3;
        const ib = indices[i + 1] * 3;
        const ic = indices[i + 2] * 3;

        // 法线
        dv.setFloat32(offset, normals[ia], true);
        dv.setFloat32(offset + 4, normals[ia + 1], true);
        dv.setFloat32(offset + 8, normals[ia + 2], true);
        offset += 12;

        // 三个顶点
        [ia, ib, ic].forEach(idx => {
            dv.setFloat32(offset, positions[idx], true);
            dv.setFloat32(offset + 4, positions[idx + 1], true);
            dv.setFloat32(offset + 8, positions[idx + 2], true);
            offset += 12;
        });

        // 属性字节数 (2 字节)
        dv.setUint16(offset, 0, true);
        offset += 2;
    }

    return new Blob([buffer], { type: 'application/octet-stream' });
}

/**
 * 导出 OBJ 格式
 */
export function exportOBJ(heightmapData, name = 'terrain') {
    const geoData = heightmapToGeometry(heightmapData);
    const { positions, normals, uvs, indices } = geoData;

    let obj = `# 3D Terrain Generator - OBJ Export\n`;
    obj += `# Vertices: ${positions.length / 3}, Faces: ${indices.length / 3}\n`;
    obj += `o ${name}\n\n`;

    // 顶点
    for (let i = 0; i < positions.length; i += 3) {
        obj += `v ${positions[i].toFixed(6)} ${positions[i + 1].toFixed(6)} ${positions[i + 2].toFixed(6)}\n`;
    }

    obj += `\n`;

    // UV
    for (let i = 0; i < uvs.length; i += 2) {
        obj += `vt ${uvs[i].toFixed(6)} ${uvs[i + 1].toFixed(6)}\n`;
    }

    obj += `\n`;

    // 法线
    for (let i = 0; i < normals.length; i += 3) {
        obj += `vn ${normals[i].toFixed(6)} ${normals[i + 1].toFixed(6)} ${normals[i + 2].toFixed(6)}\n`;
    }

    obj += `\n`;

    // 面
    obj += `usemtl terrain_material\n`;
    obj += `s 1\n`;
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] + 1;
        const b = indices[i + 1] + 1;
        const c = indices[i + 2] + 1;
        // OBJ 索引从 1 开始
        obj += `f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}\n`;
    }

    return obj;
}

/**
 * 导出为 Blob 并下载
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * 下载文本文件
 */
export function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, filename);
}

/**
 * 获取导出文件建议名
 */
export function getExportFilename(prefix, ext) {
    const date = new Date();
    const ts = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
    return `${prefix}_${ts}.${ext}`;
}
