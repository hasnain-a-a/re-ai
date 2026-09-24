import { defineConfig } from 'tsup';

const shared = {
  format: ['esm', 'cjs'] as const,
  dts: true,
  splitting: false,
  sourcemap: false,
  outExtension({ format }: { format: string }) {
    return { js: format === 'esm' ? '.js' : '.cjs' };
  },
  external: ['@nestjs/common', '@nestjs/core', 'reflect-metadata', 'pg', 'react', '@hasnain-a-a/re-ui-kit'],
};

export default defineConfig([
  { ...shared, entry: { index: 'src/index.ts', 'nest/index': 'src/nest/index.ts' } },
  // Separate build so only the React entry carries the Next.js client-component directive.
  { ...shared, entry: { 'react/index': 'src/react/index.ts' }, banner: { js: "'use client';" } },
]);
