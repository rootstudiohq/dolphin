import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
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
  env: {
    SENTRY_DSN: process.env.SENTRY_DSN || '',
  },
  esbuildPlugins: [
    // Put the Sentry esbuild plugin after all other plugins
    sentryEsbuildPlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      telemetry: false,
    }),
  ],
});
