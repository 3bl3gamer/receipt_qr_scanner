import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import replace from '@rollup/plugin-replace'
import copy from 'rollup-plugin-copy'

export default async function (commandOptions) {
	const isProd = process.env.NODE_ENV === 'production'
	return [
		{
			input: 'src/index.js',
			output: {
				format: 'esm',
				dir: 'dist',
				entryFileNames: isProd ? 'bundle.[hash].js' : 'bundle.js',
				assetFileNames: isProd ? '[name].[hash][extname]' : '[name][extname]',
				sourcemap: true,
			},
			plugins: [
				css({ name: 'bundle.css' }),
				replace({ 'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development') }),
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
				nodeResolve({ mainFields: (isProd ? [] : ['source']).concat(['module', 'main']) }),
				typescript(),
				copy({
					targets: [
						{ src: 'src/icon-256.png', dest: 'dist' },
						{ src: 'src/image_icon.svg', dest: 'dist' },
						{ src: 'src/developer_mode_icon.svg', dest: 'dist' },
						{ src: 'src/receipt_qr_scanner.webmanifest', dest: 'dist' },
					],
				}),
			],
			watch: { clearScreen: false },
		},
		{
			input: 'src/service_worker.js',
			output: {
				format: 'esm',
				dir: 'dist',
				entryFileNames: 'service_worker.js',
				sourcemap: true,
			},
		},
	]
}

function css({ name }) {
	let style = null
	return {
		name: 'css',
		transform(code, id) {
			if (!id.endsWith('.css')) return
			if (style !== null) throw new Error('multiple css files not supported here')
			style = code
			return ''
		},
		generateBundle(opts) {
			this.emitFile({ type: 'asset', name, source: style })
			style = null
		},
	}
}
