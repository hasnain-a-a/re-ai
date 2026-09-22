import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'nest/index': 'src/nest/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  external: ['@nestjs/common', '@nestjs/core', 'reflect-metadata', 'pg'],
});
