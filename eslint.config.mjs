import simon from '@antfu/eslint-config'

export default simon({
  rules: {
    'no-console': 'off',
    'style/indent': 'off',
    'style/comma-dangle': 'off',
    'no-template-curly-in-string': 'off',
    'e18e/prefer-array-from-map': 'off',
    'e18e/prefer-static-regex': 'off',
  },
  ignores: ['**/fixtures', 'test'],
})
