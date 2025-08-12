const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Основная функция сборки
async function build() {
  try {
    // 1. Собираем UI модули отдельно
    const createIconResult = await esbuild.build({
      entryPoints: ['src/ui/createIcon.ts'],
      bundle: true,
      write: false,
      target: 'es2017',
      format: 'iife',
      globalName: 'UIModules',
      loader: { '.ts': 'ts' },
    });
    
    const showPopoverResult = await esbuild.build({
      entryPoints: ['src/ui/showPopover.ts'],
      bundle: true,
      write: false,
      target: 'es2017',
      format: 'iife',
      globalName: 'UIModules',
      loader: { '.ts': 'ts' },
    });
    
    const sortGroupsResult = await esbuild.build({
      entryPoints: ['src/ui/sortGroups.ts'],
      bundle: true,
      write: false,
      target: 'es2017',
      format: 'iife',
      globalName: 'UIModules',
      loader: { '.ts': 'ts' },
    });
    
    const updateStatisticsResult = await esbuild.build({
      entryPoints: ['src/ui/updateStatistics.ts'],
      bundle: true,
      write: false,
      target: 'es2017',
      format: 'iife',
      globalName: 'UIModules',
      loader: { '.ts': 'ts' },
    });
    
    const uiModulesCode = createIconResult.outputFiles[0].text + '\n' + showPopoverResult.outputFiles[0].text + '\n' + sortGroupsResult.outputFiles[0].text + '\n' + updateStatisticsResult.outputFiles[0].text;

    // 2. Собираем основной код плагина (backend)
    await esbuild.build({
      entryPoints: ['src/js/index.ts'],
      bundle: true,
      outfile: 'dist/code.js',
      target: 'es2017',
      format: 'cjs',
      loader: { '.ts': 'ts' },
    });

    // 3. Встраиваем CSS и UI модули в HTML
    const cssContent = fs.readFileSync(path.resolve(__dirname, 'src/ui/ui.css'), 'utf8');
    let htmlContent = fs.readFileSync(path.resolve(__dirname, 'src/ui/ui.html'), 'utf8');
    
    // Создаем директорию dist, если она не существует
    const distDir = path.resolve(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Встраиваем UI модули в HTML перед закрывающим тегом </body>
    const finalHtml = htmlContent
      .replace('</head>', `</head><style>${cssContent}</style>`)
      .replace('</body>', `<script>${uiModulesCode}</script></body>`);
      
    fs.writeFileSync(path.resolve(__dirname, 'dist/ui.html'), finalHtml);

    console.log('Build successful!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
