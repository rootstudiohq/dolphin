import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  splitting: false,
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production' ? true : false,
  noExternal: [/./],
  format: ['cjs'],
  target: 'node18',
  clean: true,
});
