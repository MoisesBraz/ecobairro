import config from '../../packages/eslint-config/react.mjs';

export default [
  ...config,
  {
    ignores: [
      'dist/**',
      '.nitro/**',
      '.output/**',
      '.tanstack/**',
      'src/routeTree.gen.ts',
      'src/@layouts/**',
      'src/mocks/**',
      // Componentes vendored (adaptados de bibliotecas) — mantemos como veio
      'src/components/ui/fluid-cursor.tsx',
      'src/components/ui/orbital-globe.tsx',
      'src/components/ui/spotlight.tsx',
    ],
  },
];
