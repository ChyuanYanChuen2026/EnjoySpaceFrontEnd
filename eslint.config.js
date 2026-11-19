import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

// 只檢查可能造成執行錯誤的問題，不強制改寫現有排版。
export default [
  { ignores: ['dist/**', 'dist-cloudflare/**', 'node_modules/**', 'tmp/**', '.wrangler/**'] },
  ...pluginVue.configs['flat/base'],
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-func-assign': 'error',
    },
  },
  {
    files: ['src/**/*.vue'],
    rules: {
      'vue/no-undef-components': ['error', { ignorePatterns: ['RouterLink', 'RouterView'] }],
      'vue/no-undef-directives': 'error',
      'vue/no-undef-properties': 'error',
    },
  },
];
