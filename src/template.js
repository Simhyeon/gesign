'use strict;'

const fs = require('fs');
const path = require('path');

module.exports = {
	// FUNCTION ::: Get template with given name
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

	// FUNCTION ::: Exort editor content into 
	// markdown file with given name
	ExportTemplate(content, file) {
		if (path.extname(file) !== ".md") {
			file += ".md";
		}

		fs.writeFileSync(file, content);
	}
}
