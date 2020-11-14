const fs = require("fs");

module.exports = {
	Config : class Config {
		Config() {
			this.readConfig = "";
		}

		readFromFile(filePath) {
				// if given filePath is not same with name? ignore it if not json file then ignore
			try {
				let result = fs.readFileSync(filePath);
				this.readConfig = JSON.parse(result);
				console.log("Read");
				console.log(this.readConfig);
			} catch (error) {
				console.log("Failed to read file ERR ::: " + error);
				this.readConfig = "";
			}
		}

		getExclusionRules() {
			if (this.readConfig === "") return new Array();
			return this.readConfig["exclusion"];
		}

		getProjectSetting() {
			return this.readConfig["projectSetting"];
		}
	}
}

class Config {
	Config() {
		this.readConfig = "";
	}

	readFromFile(filePath) {
		// if given filePath is not same with name? ignore it if not json file then ignore
		try {
			let result = fs.readFileSync(filePath);
			this.readConfig = JSON.parse(result);
		} catch (error) {
			console.log("Failed to read file ERR ::: " + error);
		}
	}
	getExclusionRules() {
		return this.readConfig["exclusion"];
	}
	getProjectSetting() {
		return this.readConfig["projectSetting"];
	}
}
