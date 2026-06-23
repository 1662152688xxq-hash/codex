/**
 * 3D 渲染引擎（Three.js）
 * - 场景管理
 * - 地形网格生成/更新
 * - 颜色方案
 * - 交互控制
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { heightmapToGeometry } from './terrain.js';

/**
 * 地图颜色方案
 */
export const COLOR_SCHEMES = {
    elevation: [
        { stop: 0.0, color: new THREE.Color('#1a5276') },   // 深海蓝
        { stop: 0.2, color: new THREE.Color('#2e86c1') },   // 浅海
        { stop: 0.35, color: new THREE.Color('#52be80') },  // 绿色植被
        { stop: 0.5, color: new THREE.Color('#7d6608') },   // 丘陵棕
        { stop: 0.65, color: new THREE.Color('#a04000') },  // 山地
        { stop: 0.8, color: new THREE.Color('#d5dbdb') },   // 岩石
        { stop: 1.0, color: new THREE.Color('#ffffff') },   // 雪顶
    ],
    satellite: [
        { stop: 0.0, color: new THREE.Color('#0b3d60') },
        { stop: 0.15, color: new THREE.Color('#1a6b4a') },
        { stop: 0.4, color: new THREE.Color('#3c8d3c') },
        { stop: 0.6, color: new THREE.Color('#6d9e3c') },
        { stop: 0.75, color: new THREE.Color('#a08c3c') },
        { stop: 0.9, color: new THREE.Color('#8b7355') },
        { stop: 1.0, color: new THREE.Color('#f5f5dc') },
    ],
    thermal: [
        { stop: 0.0, color: new THREE.Color('#000000') },
        { stop: 0.2, color: new THREE.Color('#1a0a2e') },
        { stop: 0.4, color: new THREE.Color('#e74c3c') },
        { stop: 0.6, color: new THREE.Color('#f39c12') },
        { stop: 0.8, color: new THREE.Color('#f1c40f') },
        { stop: 1.0, color: new THREE.Color('#ffffff') },
    ],
    grayscale: [
        { stop: 0.0, color: new THREE.Color('#000000') },
        { stop: 0.5, color: new THREE.Color('#888888') },
        { stop: 1.0, color: new THREE.Color('#ffffff') },
    ],
    custom: null // 由用户定义
};

/**
 * 3D 场景管理器
 */
export class TerrainRenderer {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.terrainMesh = null;
        this.wireframeMesh = null;
        this.gridHelper = null;
        this.autoRotate = true;
        this.colorScheme = 'elevation';
        this.customColors = null;

        this._initScene();
        this._initLights();
        this._initGrid();
        this._animate();
    }

    _initScene() {
        // 场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1a);
        this.scene.fog = new THREE.Fog(0x0a0a1a, 80, 150);

        // 相机
        const rect = this.container.getBoundingClientRect();
        const aspect = rect.width / rect.height;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 500);
        this.camera.position.set(40, 30, 40);
        this.camera.lookAt(0, 0, 0);

        // 渲染器
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(rect.width, rect.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.container.appendChild(this.renderer.domElement);

        // 轨道控制器
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 200;
        this.controls.maxPolarAngle = Math.PI / 2.1;
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        // 窗口大小变化自适应
        this._onResize = this._onResize.bind(this);
        window.addEventListener('resize', this._onResize);
    }

    _initLights() {
        // 环境光
        const ambient = new THREE.AmbientLight(0x404060, 0.4);
        this.scene.add(ambient);

        // 半球光
        const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362d1a, 0.6);
        this.scene.add(hemi);

        // 主平行光（带阴影）
        const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
        sun.position.set(30, 50, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 120;
        sun.shadow.camera.left = -60;
        sun.shadow.camera.right = 60;
        sun.shadow.camera.top = 60;
        sun.shadow.camera.bottom = -60;
        sun.shadow.bias = -0.001;
        this.scene.add(sun);
        this.sunLight = sun;

        // 补光
        const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
        fill.position.set(-30, 20, -20);
        this.scene.add(fill);

        // 环境光辅助
        const rim = new THREE.DirectionalLight(0xff8844, 0.2);
        rim.position.set(-20, 10, 30);
        this.scene.add(rim);
    }

    _initGrid() {
        // 网格地面
        this.gridHelper = new THREE.Group();

        const grid = new THREE.GridHelper(120, 30, 0x444466, 0x333355);
        grid.position.y = -0.5;
        this.gridHelper.add(grid);

        const ringGeo = new THREE.RingGeometry(58, 60, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x444466,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.5;
        this.gridHelper.add(ring);

        this.scene.add(this.gridHelper);
    }

    /**
     * 根据高度值获取颜色
     */
    _getColor(height, scheme = this.colorScheme, customColors = this.customColors) {
        let stops;
        if (scheme === 'custom' && customColors) {
            stops = customColors;
        } else {
            stops = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.elevation;
        }

        if (!stops || stops.length === 0) return new THREE.Color(0x888888);

        // 找到两个 stops 之间插值
        for (let i = 0; i < stops.length - 1; i++) {
            if (height >= stops[i].stop && height <= stops[i + 1].stop) {
                const t = (height - stops[i].stop) / (stops[i + 1].stop - stops[i].stop);
                return stops[i].color.clone().lerp(stops[i + 1].color, t);
            }
        }

        if (height <= stops[0].stop) return stops[0].color.clone();
        return stops[stops.length - 1].color.clone();
    }

    /**
     * 构建地形网格
     */
    buildTerrain(heightmapData, showWireframe = true) {
        // 移除旧网格
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            this.terrainMesh.geometry.dispose();
            this.terrainMesh.material.dispose();
            this.terrainMesh = null;
        }
        if (this.wireframeMesh) {
            this.scene.remove(this.wireframeMesh);
            this.wireframeMesh.geometry.dispose();
            this.wireframeMesh.material.dispose();
            this.wireframeMesh = null;
        }

        // 转换为几何数据
        const geoData = heightmapToGeometry(heightmapData);
        const { positions, normals, uvs, indices, vertexCount } = geoData;

        // 构建颜色数组
        const { data, heightScale } = heightmapData;
        const colors = new Float32Array(vertexCount * 3);
        for (let i = 0; i < vertexCount; i++) {
            const h = data[i];
            const color = this._getColor(h);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        // 创建 BufferGeometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));

        // 材质
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.6,
            metalness: 0.1,
            flatShading: false,
            side: THREE.DoubleSide,
            envMapIntensity: 0.4,
        });

        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.terrainMesh.castShadow = true;
        this.terrainMesh.receiveShadow = true;
        this.scene.add(this.terrainMesh);

        // 线框
        if (showWireframe && heightmapData.width <= 256 && heightmapData.height <= 256) {
            const wireMat = new THREE.MeshBasicMaterial({
                color: 0x88ccff,
                wireframe: true,
                transparent: true,
                opacity: 0.08
            });
            this.wireframeMesh = new THREE.Mesh(geometry.clone(), wireMat);
            this.scene.add(this.wireframeMesh);
        }

        // 更新相机目标以适配地形
        const size = Math.min(heightmapData.width, heightmapData.height);
        const dist = size * 0.7;
        this.camera.position.set(dist * 0.7, dist * 0.5, dist * 0.7);
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        return geoData;
    }

    /**
     * 更新地形颜色（切换颜色方案时）
     */
    updateColors(heightmapData) {
        if (!this.terrainMesh) return;

        const { data } = heightmapData;
        const position = this.terrainMesh.geometry.getAttribute('position');
        const vertexCount = position.count;
        const colors = new Float32Array(vertexCount * 3);

        for (let i = 0; i < vertexCount; i++) {
            const h = data[i] !== undefined ? data[i] : 0;
            const color = this._getColor(h);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        this.terrainMesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.terrainMesh.geometry.attributes.color.needsUpdate = true;
    }

    /**
     * 切换线框显示
     */
    setWireframe(visible) {
        if (this.wireframeMesh) {
            this.wireframeMesh.visible = visible;
        }
    }

    /**
     * 切换网格显示
     */
    setGrid(visible) {
        if (this.gridHelper) {
            this.gridHelper.visible = visible;
        }
    }

    /**
     * 切换自动旋转
     */
    setAutoRotate(enable) {
        this.autoRotate = enable;
        if (this.controls) {
            this.controls.autoRotate = enable;
            this.controls.autoRotateSpeed = 1.5;
        }
    }

    /**
     * 截图
     */
    screenshot() {
        this.renderer.render(this.scene, this.camera);
        const link = document.createElement('a');
        link.download = `terrain_${Date.now()}.png`;
        link.href = this.renderer.domElement.toDataURL('image/png');
        link.click();
    }

    /**
     * 获取地形在射线下的交点
     */
    raycast(clientX, clientY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(x, y);
        raycaster.setFromCamera(mouse, this.camera);

        if (!this.terrainMesh) return null;

        const intersects = raycaster.intersectObject(this.terrainMesh, false);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            return {
                x: point.x.toFixed(2),
                y: point.y.toFixed(2),
                z: point.z.toFixed(2)
            };
        }
        return null;
    }

    _onResize() {
        const rect = this.container.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * 清理资源
     */
    dispose() {
        window.removeEventListener('resize', this._onResize);
        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }
        if (this.terrainMesh) {
            this.terrainMesh.geometry.dispose();
            this.terrainMesh.material.dispose();
        }
        if (this.wireframeMesh) {
            this.wireframeMesh.geometry.dispose();
            this.wireframeMesh.material.dispose();
        }
    }
}
