import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import copy from 'rollup-plugin-copy'
import typescript from 'rollup-plugin-typescript2'

export default async function (commandOptions) {
	const isProd = process.env.NODE_ENV === 'production'
	return [
		{
			input: 'src/index.tsx',
			output: {
				format: 'esm',
				dir: 'dist',
				entryFileNames: isProd ? 'bundle.[hash].js' : 'bundle.js',
				assetFileNames: isProd ? '[name].[hash][extname]' : '[name][extname]',
				sourcemap: true,
			},
			plugins: [
				css({ name: 'bundle.css' }),
				!isProd &&
					(await import('rollup-plugin-serve').then(({ default: serve }) =>
						serve({
							contentBase: 'dist',
							host: commandOptions.configHost || 'localhost',
							port: commandOptions.configPort || '12345',
						}),
					)),
				!isProd &&
					(await import('rollup-plugin-livereload').then(({ default: livereload }) =>
						livereload({ verbose: true, watch: 'dist/bundle.js' }),
					)),
				commonjs({}),
				nodeResolve({
					mainFields: (isProd ? [] : ['source']).concat(['module', 'main']),
					extensions: ['.js', '.jsx', '.ts', '.tsx'],
				}),
				typescript({
					exclude: ['src/vendor/**/*'],
				}),
				typescript({
					check: false,
					include: ['src/vendor/**/*'],
				}),
				replace({
					// должно идти после typescript(), иначе он будет ругаться на "production" === "development"
					'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
					preventAssignment: true,
				}),
				copy({
					targets: [{ src: 'public/**/*', dest: 'dist' }],
				}),
			],
			watch: { clearScreen: false },
		},
		{
			input: 'src/service_worker.ts',
			output: {
				format: 'esm',
				dir: 'dist',
				entryFileNames: 'service_worker.js',
				sourcemap: true,
			},
			plugins: [
				typescript({
					exclude: ['src/vendor/**/*'],
				}),
			],
		},
	]
}

function css({ name }) {
	const styles = {}
	return {
		name: 'css',
		transform(code, id) {
			if (!id.endsWith('.css')) return
			styles[id] = code
			return ''
		},
		generateBundle(_opts, _bundle) {
			const moduleIds = new Set(this.getModuleIds())
			for (const key of Object.keys(styles)) {
				if (!moduleIds.has(key)) delete styles[key]
			}
			if (Object.keys(styles).length === 0) return
			this.emitFile({ type: 'asset', name, source: Object.values(styles).join('\n\n\n') })
		},
	}
}
