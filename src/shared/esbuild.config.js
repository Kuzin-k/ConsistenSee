const esbuild = require('esbuild');
const {sassPlugin} = require('esbuild-sass-plugin');

esbuild.build({
  entryPoints: {
    'code': 'src/main/index.ts',
    'ui': 'src/ui/index.ts',
  },
  bundle: true,
  outdir: 'dist',
  platform: 'node', // или 'browser' в зависимости от вашего code.js
  format: 'cjs',      // или 'esm'
  watch: process.argv.includes('--watch'),
  plugins: [sassPlugin()],
  external: ['@figma/plugin-typings'],
}).catch(() => process.exit(1));