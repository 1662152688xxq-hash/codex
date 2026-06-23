# 🏔️ 3D 地形图生成器

一个基于 **Three.js** 的浏览器端 3D 地形生成工具。支持程序化地形生成和图片高度图导入，可导出 STL/OBJ 格式用于 3D 打印。

## ✨ 功能特性

- **🎲 程序化生成** — 使用分形布朗运动 (FBM) + Perlin 噪声生成自然地形
- **🖼️ 图片高度图** — 上传灰度图生成地形
- **🎨 多种颜色方案** — 高程着色、卫星风格、热力图、自定义颜色
- **📦 3D 导出** — 导出 STL (ASCII/Binary) 和 OBJ 格式，支持 3D 打印
- **📸 截图保存** — 一键保存当前视角为 PNG 图片
- **🎮 交互控制** — 拖拽旋转/缩放，自动旋转，坐标显示

## 🚀 在线使用

直接在浏览器中打开 `index.html` 即可使用，无需任何构建工具。

```
git clone https://github.com/your-username/terrain-3d-generator.git
cd terrain-3d-generator
# 直接用浏览器打开 index.html
```

或使用任意静态服务器：

```bash
npx serve .
# 或
python -m http.server 8080
```

## 🎮 使用说明

### 程序化生成
1. 选择「程序化」模式
2. 调整地形参数（尺寸、分辨率、高度、噪声缩放等）
3. 使用预设快速切换地形风格（山脉、丘陵、平原、峡谷）
4. 点击「生成地形」或拖动滑块实时预览

### 图片高度图
1. 选择「图片高度图」模式
2. 上传灰度图片（白色 = 高，黑色 = 低）
3. 调整高度强度
4. 自动生成地形

### 导出
- **STL** — 适用于 3D 打印，大模型自动使用 Binary 格式
- **OBJ** — 适用于其他 3D 软件编辑

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| [Three.js](https://threejs.org/) | 3D 渲染引擎 |
| Perlin / Simplex Noise | 程序化地形生成算法 |
| FBM (分形布朗运动) | 多细节层次地形叠加 |
| OrbitControls | 相机轨道控制 |

## 📁 项目结构

```
terrain-3d-generator/
├── index.html          # 主页面
├── style.css           # 样式
├── js/
│   ├── main.js         # 主入口逻辑
│   ├── terrain.js      # 地形生成引擎
│   ├── noise.js        # 噪声算法
│   ├── renderer.js     # 3D 渲染（Three.js）
│   └── export.js       # STL/OBJ 导出
├── README.md           # 本文件
└── LICENSE             # MIT 许可证
```

## 📄 许可证

MIT License

---

**Made with ❤️**
