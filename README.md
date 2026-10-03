# 🌍 LIDAR & 3D Point Cloud Viewer

A high-performance, interactive 3D LIDAR and point cloud visualization tool built with **Three.js**, **TypeScript**, and **WebGL**. Supports both a standalone **Desktop App (Electron)** and a zero-install **Web Application (GitHub Pages)**.

---

## ✨ Features

- 🚀 **High-Performance WebGL Engine:** Single draw-call rendering via `THREE.Points` and contiguous `Float32Array` buffers for rendering hundreds of thousands of points at a locked 60 FPS.
- 🎨 **Eye-Dome Lighting (EDL):** Screen-space post-processing depth shader to accentuate silhouettes, terrain relief, and crevices.
- ⚡ **Background Web Worker Parser:** Zero-UI-freeze file parsing using `Transferable Objects` and line-by-line char scanning.
- 🎨 **Instant GPU Colormaps:**
  - Sensor RGB (True Colors)
  - Elevation: Turbo
  - Elevation: Viridis
  - Elevation: Plasma
  - Elevation: Rainbow
  - Intensity / Grayscale
- 📏 **3D Distance & Elevation Measurement Tool:**
  - Interactive point picking with anti-occluded dimension lines (`depthTest: false`, 6px `Line2`).
  - Calculates 3D Euclidean Distance, Horizontal ($\Delta H$), and Vertical Elevation ($\Delta Z$).
- 🔍 **Real-Time Point Inspector:** Hover to inspect exact Easting ($X$), Northing ($Y$), and Elevation ($Z$) in meters.
- 🎥 **Camera Navigation & Presets:** Quick alignment to **Top (Plan)**, **Front**, **Side**, and **Isometric**, with switchable **Perspective / Orthographic** projection.
- 📸 **High-Resolution Snapshot:** One-click PNG snapshot export.
- 🗕 **Collapsible & Mobile Ready:** Minimize menu button with responsive mobile layout and `M` shortcut.
- 📂 **Multi-Format & Drag-and-Drop:** Native file open dialog and direct drag-and-drop for `.txt`, `.xyz`, `.pts`, `.csv`, `.asc`.
- 🌐 **Dual Target:** Runs natively on Desktop via Electron or as a static Web App in any browser.

---

## 🚀 NPM Commands Matrix

| Task | Web Application (Browser) | Desktop Application (Electron) |
| :--- | :--- | :--- |
| ⚡ **Live Dev / Watch** | `npm run dev:web` *(or `npm run dev`)* | `npm run dev:electron` |
| 🏗️ **Production Build** | `npm run build:web` *(or `npm run build`)* | `npm run build:electron` |
| ▶️ **Run Application** | `npm run start:web` | `npm run start:electron` *(or `npm start`)* |

---

## 🛠️ Tech Stack
- **Engine:** [Three.js](https://threejs.org/) (r170+)
- **Language:** TypeScript
- **Bundler:** Webpack 5 + `ts-loader`
- **Desktop Framework:** Electron
- **CI/CD:** GitHub Actions $\rightarrow$ GitHub Pages
