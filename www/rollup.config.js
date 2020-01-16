import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import typescript from '@rollup/plugin-typescript'

function mustImport(name) {
	return import(name).catch(err => {
		throw err
	})
}

export default function(commandOptions) {
	const isProd = process.env.NODE_ENV === 'production'

	let devPlugins = []
	if (!isProd)
		devPlugins.push(
			mustImport('rollup-plugin-serve').then(({ default: serve }) =>
				serve({
					contentBase: 'dist',
					host: commandOptions.configHost || 'localhost',
					port: commandOptions.configPort || '12345',
				}),
			),
			mustImport('rollup-plugin-livereload').then(({ default: livereload }) =>
				livereload({ verbose: true, watch: 'dist/bundle.js' }),
			),
		)

	return Promise.all(devPlugins).then(devPlugins => ({
		input: 'src/index.js',
		output: {
			format: 'esm',
			dir: 'dist',
			entryFileNames: isProd ? 'bundle.[hash].js' : 'bundle.js',
			sourcemap: true,
		},
		plugins: [
			...devPlugins,
			commonjs({}),
			nodeResolve({ mainFields: (isProd ? [] : ['source']).concat(['module', 'main']) }),
			typescript(),
		],
		watch: { clearScreen: false },
	}))
}
