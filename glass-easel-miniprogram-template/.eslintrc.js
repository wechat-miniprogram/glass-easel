module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 9,
    sourceType: 'module',
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'promise'],
  globals: {
    Component: true,
    Page: true,
  },
}
