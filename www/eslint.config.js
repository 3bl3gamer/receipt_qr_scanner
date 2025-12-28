import { defineConfig } from 'eslint/config'
import preact from 'eslint-config-preact'
import tseslint from 'typescript-eslint'

export default defineConfig([
	...preact,
	{
		ignores: ['node_modules/', 'dist/', 'src/vendor/'],
	},
	{
		rules: {
			'no-console': 'warn',
			'no-unused-vars': ['error', { vars: 'all', args: 'none' }],
			'prefer-template': 'off',
			'no-else-return': 'off',
			'react-hooks/rules-of-hooks': 'warn',
			'react-hooks/exhaustive-deps': 'warn',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		},
	},
	tseslint.configs.recommended,
])
