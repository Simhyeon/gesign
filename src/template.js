'use strict;'

const fs = require('fs');
const path = require('path');

module.exports = {
	GetTemplateContent(file) {
		if (path.extname(file) !== ".md") return;

		try {
			let content = fs.readFileSync(file);
			return content;
		} catch {
			console.error("Failed to read template");
			return;
		}
	},

	ExportTemplate(content, file) {
		if (path.extname(file) !== ".md") {
			file += ".md";
		}

		fs.writeFileSync(file, content);
	}
}
