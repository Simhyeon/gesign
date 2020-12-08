const fs = require("fs");
const shared = require('./shared');
//const self = module.exports;

module.exports = {
	CONFIGFILENAME : "gesign_config.json",
	// CLASS ::: Config class that handles all logics related to gesign_config.js file
	init: function(filePath) {
		this.readFromFile(filePath);
	},
	//content: function() {
		//return this.content;
	//},
	exclusionRules: function() {
		if (this.content === "") return new Array();
		return this.content["exclusion"];
	},
	// FUNCTION ::: Read config file from given path
	readFromFile: function(filePath) {
		// if given filePath is not same with name? ignore it if not json file then ignore
		try {
			let result = fs.readFileSync(filePath);
			this.content = JSON.parse(result);
		} catch (error) {
			console.log("Failed to read file or file doesn't exist. Error content : " + error);
			// Set config to Default
			this.content = this.default();
			let userInput = confirm("No config file found create new one?");
			if (userInput) {
				fs.writeFileSync(filePath, this.content);
			} else {
				shared.noconfig = true;
			}
		}
	},
	// FUNCTION ::: Return default config object
	default: function() {
		return { 
			exclusion: new Array(),
			startMode: "wysiwyg",
			fontSize: "small",
			templatePath: "templates",
			checkOnSave : false,
			unpinAuto : false
		}
	}
}
