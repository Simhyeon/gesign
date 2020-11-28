const fs = require("fs");

module.exports = {
	// CLASS ::: Config class that handles all logics related to gesign_config.js file
	Config : class Config {
		Config() {
			this.content = "";
		}

		// TODO ::: Make this get directory so that modification of config file name doesn't affect this logics.
		// FUNCTION ::: Read config file from given path
		readFromFile(filePath) {
				// if given filePath is not same with name? ignore it if not json file then ignore
			try {
				let result = fs.readFileSync(filePath);
				this.content = JSON.parse(result);
			} catch (error) {
				console.log("Failed to read file or file doesn't exist. Error content : " + error);
				// Set config to Default
				this.content = this.default();
			}
		}

		// FUNCTION ::: Simply return exclusion rules
		getExclusionRules() {
			if (this.content === "") return new Array();
			return this.content["exclusion"];
		}

		// FUNCTION ::: Return default config object
		default() {
			return { 
				exclusion: new Array(),
				startMode: "wysiwyg",
				fontSize: "small",
				templatePath: "templates",
				checkOnSave : false
			}
		}
	}
}
