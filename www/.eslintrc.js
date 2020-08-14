module.exports = {
	env: {
		browser: true,
		es6: true,
	},
	extends: 'plugin:prettier/recommended',
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
	},
	ignorePatterns: ['vendor/'],
	rules: {
		'no-console': 'warn',
		'no-unused-vars': ['error', { vars: 'all', args: 'none' }],
		'no-undef': 'error',
	},
	globals: {
		Atomics: 'readonly',
		SharedArrayBuffer: 'readonly',
		process: true,
	},
}
