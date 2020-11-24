module.exports = {
	future: {
		// removeDeprecatedGapUtilities: true,
		// purgeLayersByDefault: true,
	},
	//purge: [],
	purge: [
		'./src/index.css',
		'./src/index.html',
		'./src/*.js'
	],
	theme: {
		extend: {},
	},
	variants: {},
	plugins: [],
}
