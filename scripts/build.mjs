import { rollup } from 'rollup';
import fs from 'node:fs';
import path from 'node:path';

const localPlugin = {
  name: 'local-plugin',
  resolveId(source, importer) {
    if (source.endsWith('.css')) {
      return 'virtual:empty-css';
    }
    if (source.startsWith('.')) {
      const dir = importer ? path.dirname(importer) : path.resolve('dist-ts');
      const base = path.resolve(dir, source);
      for (const ext of ['', '.js', '.json']) {
        if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) {
          return base + ext;
        }
      }
    }
    return null;
  },
  load(id) {
    if (id === 'virtual:empty-css') {
      return '';
    }
    if (id.endsWith('.json')) {
      const content = fs.readFileSync(id, 'utf8');
      return `export default ${content};`;
    }
    return null;
  }
};

console.log('Bundling with native Rollup...');
try {
  const bundle = await rollup({
    input: path.resolve('dist-ts/main.js'),
    external: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'clsx',
      'lucide-react'
    ],
    plugins: [localPlugin]
  });

  if (!fs.existsSync('dist')) fs.mkdirSync('dist');
  await bundle.write({
    file: 'dist/bundle.esm.js',
    format: 'es'
  });
  console.log('SUCCESS: dist/bundle.esm.js created!');
} catch (err) {
  console.error('Bundle error:', err);
  process.exit(1);
}
