const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'styles');
const distDir = path.join(__dirname, '..', 'dist');
const distStylesDir = path.join(distDir, 'styles');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
if (!fs.existsSync(distStylesDir)) {
  fs.mkdirSync(distStylesDir, { recursive: true });
}

// 1. Copy all individual CSS files to dist/styles
const cssFiles = ['variables.css', 'base.css', 'panel.css', 'toolbar.css', 'hud.css', 'main.css'];
cssFiles.forEach((file) => {
  const srcFile = path.join(srcDir, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, path.join(distStylesDir, file));
  }
});

// 2. Concatenate modular stylesheets into a single self-contained dist/style.css
const order = ['variables.css', 'base.css', 'panel.css', 'toolbar.css', 'hud.css'];
let bundledCss = '/* LIDAR Modelling Unified Production Stylesheet */\n';
order.forEach((file) => {
  const filePath = path.join(srcDir, file);
  if (fs.existsSync(filePath)) {
    bundledCss += `\n/* --- ${file} --- */\n` + fs.readFileSync(filePath, 'utf8') + '\n';
  }
});

fs.writeFileSync(path.join(distDir, 'style.css'), bundledCss, 'utf8');
console.log('CSS built successfully into dist/style.css and dist/styles/');
