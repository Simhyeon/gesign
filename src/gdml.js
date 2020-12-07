let gdmlTags = new Array("status", "lastModified", "reference", "body");

module.exports = {
	// FUNCTION :: Create new gdml object
	newGdml: function() {
		return {
			status: "UPTODATE", 
			//TODO SHOULD SET TIMESTAMPE
			lastModified : Date.now(),
			reference: new Array(),
			body: ""
		}
	},
	// FUNCTION ::: Check if given file is valid gdml 
	// or following gdml specification.
	IsValidGdml : function(fullPath)  {
		let result = null;
		if (path.extname(fullPath) !== ".gdml") return false;
		try {
			result = yaml.load(fs.readFileSync(fullPath));
		} catch {
			return false;
		}
		let isValid = true;

		if (result === null || result === undefined) {
			return false;
		}

		gdmlTags.forEach((tag) => {
			if (result[tag] === null || result[tag] === undefined ) {
				isValid = false;
			}
		});
		return isValid;
	},
	// FUNCTION ::: Check if given string follows gdml specification.
	IsValidGdmlString: function(content) {
		let isValid = true;
		if (content === null || content === undefined) {
			return false;
		}

		gdmlTags.forEach((tag) => {
			if (content[tag] === null || content[tag] === undefined ) {
				isValid = false;
			}
		});
		return isValid;
	}
}
