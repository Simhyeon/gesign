const {dialog} = require('electron').remote;
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const marked = require('marked');

const Editor = require('@toast-ui/editor');
const uiEditor = require('@toast-ui/editor')
const editorDiv = document.querySelector('#editor');

const sideMenu = document.querySelector('#menuContents');

// Make Editor component
const editor = new Editor({
	el: editorDiv,
	previewStyle: 'tab',
	height: '100%',
	initialEditType: 'wysiwyg',
	language: 'ko'
});
editor.getHtml();

let fileCache;
let contentCache;
let dirCache;
// Show open file dialog and display file content to editor
document.querySelector('#openFileBtn').addEventListener('click', () => {
	let filt = [
		{
			name:"GDML", extensions: ['yml', 'gdml']
		}
	];
	dialog.showOpenDialog({defaultPath: __dirname, properties: ['openFile'], filters: filt}).then((response) => {
		if (!response.canceled) {
			console.log(response.filePaths[0]);
			fs.readFile(response.filePaths[0], 'utf8', (err, data) => {
				if (err) {
					alert("Failed to read file");
					return;
				}
				fileCache = response.filePaths[0];
				contentCache = yaml.load(data);
				console.log(contentCache["status"]);
				console.log(contentCache["body"]);
				editor.setMarkdown(contentCache["body"], false);
			});
		} else {
			console.log("no file selected");
		}
	})
});

// Save markdown to file.
document.querySelector('#saveFileBtn').addEventListener('click', () => {
	contentCache["body"] = editor.getMarkdown();
	console.log(yaml.safeDump(contentCache));
	fs.writeFileSync(fileCache, yaml.safeDump(contentCache), 'utf8');
	alert("Saved successfully");
});

// Open directory and get path
document.querySelector("#openDirBtn").addEventListener('click', () => {
	dialog.showOpenDialog({defaultPath: __dirname, properties: ["openDirectory"]}).then((response) => {
		if(!response.canceled) {
			dirCache = response.filePaths[0];
			console.log(dirCache);
			fs.readdir(dirCache, (err, files) => {
				//handling error
				if (err) {
					return console.log('Unable to scan directory: ' + err);
				} 
				//listing all files using forEach
				files.forEach(function (file) {
					// Do whatever you want to do with the file
					console.log(file); 
					listFiles(file);
				});
			});
		}
	});
});

function listFiles(fileName) {
	// TODO ::: Check if filetype is gdml 
	// TODO ::: Add event listener to button 
	var elem = document.createElement('button');
	elem.textContent = fileName;
	elem.classList.add("rounded", "font-bold", "text-left")
	sideMenu.appendChild(elem);
}
