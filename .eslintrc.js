const path = require('path')

module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 9,
    sourceType: 'module',
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'promise', 'prettier'],
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'eslint-config-prettier',
      ],
      parserOptions: {
        project: path.join(__dirname, 'tsconfig.json'),
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/space-before-function-paren': [
          'error',
          { anonymous: 'always', named: 'never', asyncArrow: 'always' },
        ],
        '@typescript-eslint/no-redeclare': ['error'],
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-this-alias': 'off',
        '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      },
    },
  ],
  extends: [
    'eslint:recommended',
    'airbnb-base',
    'plugin:promise/recommended',
    'eslint-config-prettier',
  ],
  env: {
    es6: true,
    jest: true,
  },
  rules: {
    'comma-dangle': ['error', 'always-multiline'],
    'handle-callback-err': ['error', '^(err|error)$'],
    'no-catch-shadow': 'error',
    'no-underscore-dangle': 'off',
    'object-curly-spacing': ['error', 'always'],
    'max-classes-per-file': 'off',
    'no-unused-vars': 'off',
    'no-multi-assign': 'off',
    'lines-between-class-members': 'off',
    'import/prefer-default-export': 'off',
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
    'no-shadow': 'off',
    'prefer-destructuring': 'off',
    'no-continue': 'off',
    'no-use-before-define': 'off',
    'no-dupe-class-members': 'off',
    'func-names': 'off',
    'space-before-function-paren': 'off',
    'no-lonely-if': 'off',
    'no-param-reassign': ['error', { props: false }],
    'no-redeclare': 'off',
    'prettier/prettier': 'warn',
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      },
    ],
  },
}
