import simon from '@antfu/eslint-config'

export default simon({
  rules: {
    'no-console': 'off',
    'style/indent': 'off',
    'style/comma-dangle': 'off',
    'no-template-curly-in-string': 'off',
  },
  ignores: ['**/fixtures', 'test'],
})
