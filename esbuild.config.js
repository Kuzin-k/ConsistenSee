const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Основная функция сборки
async function build() {
  try {
    // 1. Собираем UI модули (TypeScript -> JavaScript) как строку
    

    // 2. Собираем основной код плагина (backend)
    await esbuild.build({
      entryPoints: ['src/js/index.ts'],
      bundle: true,
      outfile: 'dist/code.js',
      target: 'es2017', // ИЗМЕНЕНО: Повышаем стандарт до es2017 для поддержки top-level await
      format: 'cjs',
      loader: { '.ts': 'ts' },
    });

    // 3. Встраиваем CSS и UI модули в HTML
    const cssContent = fs.readFileSync(path.resolve(__dirname, 'src/ui/ui.css'), 'utf8');
    let htmlContent = fs.readFileSync(path.resolve(__dirname, 'src/ui/ui.html'), 'utf8');
    
    // Не удаляем импорты, так как они нужны для корректной работы модулей
    // Оставляем импорты в исходном виде, чтобы избежать повторного объявления функций
    
    // Создаем отдельный файл JavaScript для модулей
    // и подключаем его через тег <script src="..."> вместо импорта
    
    // Создаем директорию dist, если она не существует
    const distDir = path.resolve(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    
    const finalHtml = htmlContent.replace(
      '</head>',
      `</head><style>${cssContent}</style>`
    );
    fs.writeFileSync(path.resolve(__dirname, 'dist/ui.html'), finalHtml);

    console.log('Build successful!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
