import config from '../../packages/eslint-config/node.mjs';

export default [
  ...config,
  {
    ignores: ['dist-test/**'],
  },
];

