const fs = require("fs");

module.exports = {
	Config : class Config {
		Config() {
			this.content = "";
		}

		readFromFile(filePath) {
				// if given filePath is not same with name? ignore it if not json file then ignore
			try {
				let result = fs.readFileSync(filePath);
				this.content = JSON.parse(result);
				console.log("Read");
				console.log(this.content);
			} catch (error) {
				console.log("Failed to read file or file doesn't exist. Error content : " + error);
				// Set config to Default
				this.content = { 
					exclusion: new Array(),
					startMode: "wysiwyg",
					fontSize: "small",
					checkOnSave : false
				}
			}
		}

		getExclusionRules() {
			if (this.content === "") return new Array();
			return this.content["exclusion"];
		}
	}
}
