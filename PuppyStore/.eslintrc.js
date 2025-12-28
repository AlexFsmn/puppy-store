module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['jest.setup.js', '__tests__/**/*'],
      env: {
        jest: true,
      },
    },
  ],
  rules: {
    'react/no-unstable-nested-components': [
      'warn',
      {allowAsProps: true},
    ],
  },
};
