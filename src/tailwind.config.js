module.exports = {
	future: {
		// removeDeprecatedGapUtilities: true,
		// purgeLayersByDefault: true,
	},
	purge: {
		enabled: true,
		mode: 'layers',
	    layers: ['base', 'components', 'utilities'],
		content: ['./styles.css', './index.html'],
	},
	theme: {
		extend: {},
	},
	variants: {},
	plugins: [],
}
