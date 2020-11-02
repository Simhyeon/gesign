/// HEADER
const { remote } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const Editor = require('@toast-ui/editor');
const Checker = require('./checker').Checker;

let checker = new Checker();

// COMMENTS
// IMPORTANT NOTE !!! 
// TODO ::: Change to initilize only editor div not a whole editorScreen so that status can be displayed 

// VARAIBLE ::: Root direoctry given by user as a root for recursive file detection.
let rootDirectory;
// VARIABLE ::: Total list of gdml files
let totalGdmlList = new Array();

// VARAIBLE ::: Array that stores object of following properties
// {path: string, content: string(yaml), screen: domElement, editor: ToastEditorInstance}
let tabObjects = new Array(); // This is list of opened tabs's which has a data of yaml string

// VARAIBLE ::: Index that points to the currentTabObject
// when no tabs are open then tabIndex is -1
let currentTabIndex = -1;

// VARAIBLE ::: Caching of specific dom elements.
const tabMenu = document.querySelector("#openedTabs");
const sideMenu = document.querySelector('#menuContents');
const mainDiv = document.querySelector("#main");
const statusDiv = document.querySelector("#statusBar");
const editorScreen = document.querySelector("#editorScreen");
editorScreen.style.display = "none";

// EVENT || DEBUG ::: Make Checker object and add all gdml document sto graph node
document.querySelector("#checker").addEventListener('click', () => {
	totalGdmlList.forEach((path) => {
		let gdml = loadGdml(path);
		if (gdml == null) {
			console.error("GDML IS null;");
			return;
		}
		checker.addNode(path, gdml["reference"]);
	})

	//checker.debugPrintAll();
	let sortesList = checker.getLevelSortedList();
	console.log(sortesList);
	checker.checkDependencies(sortesList);
	console.log("After dependency check");
	console.log(sortesList);
});

// EVENT ::: Save markdown of tabObject into the file which path is associated with tabObject.
document.querySelector('#saveFileBtn').addEventListener('click', () => {
	let currentTabObject = tabObjects[currentTabIndex];
	currentTabObject.content["body"] = currentTabObject.editor.getMarkdown();
	fs.writeFileSync(currentTabObject.path, yaml.safeDump(currentTabObject.content), 'utf8');
	alert("Saved successfully");
});

// EVENT ::: Open Dialog and get rootDirectory
document.querySelector("#openDirBtn").addEventListener('click', () => {
	remote.dialog.showOpenDialog(remote.getCurrentWindow(),{defaultPath: __dirname, properties: ["openDirectory"]}).then((response) => {
		if(!response.canceled) {
			rootDirectory = response.filePaths[0];
			console.log(rootDirectory);
			fs.readdir(rootDirectory, (err, files) => {
				//handling error
				if (err) {
					return console.log('Unable to scan directory: ' + err);
				} 

				listMenuButtons(rootDirectory , files, sideMenu);
			});
		}
	});
});

// TODO ::: Make children hierarchy better not just nested.
// Add separator, Indentation might be good but it will make 
// spacing look ugly considier vertical spacing for 
// better aesthetics
// TODO ::: Might better make config file and set ignore list.
// FUNCTION ::: Create menu buttons recursively.
function listMenuButtons(root, files, parentElement) {
	// TODO ::: This should be handled as a proper config settings.
	// Do not show hidden files (files which names start with dot.)
	//files = files.filter(item => !(/(^|\/)\.[^/.]/g).test(item)); // copy pasted code

	files.forEach(function (file) {
		// Do whatever you want to do with the file
		let fullPath = path.join(root, file);
		if (path.extname(fullPath).toLowerCase() === ".gdml") {
			listFile(root, file, parentElement);
		} else if (fs.lstatSync(fullPath).isDirectory()) {
			listDirectory(root, file, parentElement);
		}
	});
}

// FUNCTION ::: Create File menu button
function listFile(root, fileName, parentElement) {
	var elem = document.createElement('button');
	elem.classList.add("rounded", "font-bold", "text-left", "py-2", "px-4", "text-white", "bg-blue-500", "fileButton", "m-2");
	let fullPath = path.join(root , fileName);
	elem.textContent = fileName;
	elem.dataset.path = fullPath;
	elem.addEventListener('click', loadGdmlToEditor);
	parentElement.appendChild(elem);
	// Add value to array(list) so that dependency checker can do his job.
	totalGdmlList.push(fullPath);
}

// FUNCTION ::: Create directory menu button
function listDirectory(root, dirName, parentElement) {
	var divElem = document.createElement('div');
	var dirElem = document.createElement('button');
	divElem.classList.add("bg-blue-200");
	dirElem.classList.add("rounded", "font-bold", "text-left", "py-2", "px-4", "text-white", "bg-blue-500", "m-2");
	let fullPath = path.join(root, dirName);
	dirElem.textContent = "|-> " + dirName;
	dirElem.dataset.path = fullPath;
	dirElem.addEventListener('click', toggleChildren);
	parentElement.appendChild(divElem);
	divElem.appendChild(dirElem);
	fs.readdir(fullPath, (err, files) => {
		if(err) {
			console.log("Failed to read recursive files in directory");
		} else {
			listMenuButtons(fullPath, files, divElem);
		}
	});
}

function loadGdml(filePath) {
	// If given file is not gdml then return
	if (path.extname(filePath).toLowerCase() !== ".gdml") return null;
	try {
		var result = fs.readFileSync(filePath);
		return yaml.load(result);
	} catch {
		console.log("No file found");
		return null;
	}
}

// FUNCTION ::: Load Gdml file contents from file and paste into the 
// newly instantiated toastui editor if not existent.
// This function is called when sideMenu button or tab button is clicked.
function loadGdmlToEditor(event) {

	// TODO ::: If tab is already open then redirect tab dat into editor.
	// Load file from fs 
	let filePath = event.currentTarget.dataset.path;
	let tabIndex = isTabPresent(filePath);

	if(tabIndex !== -1){
		// Hide current tab
		tabObjects[currentTabIndex].screen.style.display = "none";

		// Change currentTabIndex
		currentTabIndex = tabIndex;
		// And show selected tab
		tabObjects[currentTabIndex].screen.style.display = "";
		// Update Status Bar
		statusGrphics(tabObjects[currentTabIndex].content["status"]);
		return;
	}

	// When tab is opened and user is trying to open another tab with another file
	if(currentTabIndex != -1) {
		console.log("HIDING CURRENT TAB");
		tabObjects[currentTabIndex].screen.style.display = "none";
	}


	fs.readFile(filePath, 'utf8', (err, data) => {
		if (err) {
			alert("Failed to read file");
			return;
		}
		console.log("SUccesfully read gdml and pasting to editor");

		let editorScreenElem = editorScreen.cloneNode(true);
		mainDiv.appendChild(editorScreenElem);
		editorScreenElem.style.display = "";

		// Make currentTabIndex to be same as length minus 1 which is 
		// last index of newly edited array.
		// CurrentTab Index should be equal to length because in this line length is not added by 1.
		currentTabIndex = tabObjects.length;
		let editorInstance = initEditor("Editor_" + currentTabIndex, editorScreenElem);
		var tabObject = {path: filePath, content: yaml.load(data), screen: editorScreenElem, editor: editorInstance};
		tabObjects.push(tabObject);

		editorInstance.setMarkdown(tabObject.content["body"], false);
		statusGrphics(tabObjects[currentTabIndex].content["status"]);
		// TODO ::: NOT YET READY
		addNewTab(filePath);
	});
}

// FUNCTION ::: Check if tab is present in tabArray, namely tabObjects (plural)
function isTabPresent(filePath) {
	for (var i = 0, len = tabObjects.length; i < len; i++) {
		if(tabObjects[i].path === filePath) {
			return i;
		}
	}
	return -1;
}

// FUNCTION ::: Add new tab to tab menus' parent div
function addNewTab(filePath) {
	// TODO ::: Add dom element
	let btnElem = document.createElement('button');
	btnElem.classList.add("rounded", "font-bold", "text-white", "bg-blue-500", "text-center", "px-2", "mx-2");
	tabMenu.appendChild(btnElem);
	btnElem.dataset.path = filePath;
	btnElem.textContent = path.basename(filePath);
	btnElem.addEventListener('click', loadGdmlToEditor);
}


// FUNCTION ::: Toggle children elements of directory menu button
function toggleChildren(event) {
	let children = event.currentTarget.parentElement.querySelectorAll(".fileButton");
	children.forEach((child) => {
		if (child.style.display === "none") {
			child.style.display = "block";
		} else {
			child.style.display = "none";
		}
	});
}

// FUNCTION ::: Initiate ToastEditorInstance with given new Id.
// if duplicate id exists then editor would not work properly.
function initEditor(newId, element) {
	element.id = newId;
	var editor = new Editor({
		el: element,
		previewStyle: 'tab',
		height: '100%',
		initialEditType: 'wysiwyg',
		language: 'ko'
	});
	editor.getHtml();

	return editor;
}

// FUNCTION ::: Apply Status graphical effect
function statusGrphics(statusString) {
	if( statusString === "UPTODATE" ) {
		statusDiv.textContent = "Up to date";
		statusDiv.classList.add("bg-blue-200");
	} else if (statusString === "OUTDATED") {
		statusDiv.textContent = "Outdated";
		statusDiv.classList.add("bg-red-200");
	} else if (statusString === "INDEFINITE") {
		statusDiv.textContent = "Indefinte";
		statusDiv.classList.add("bg-gray-200");
	}
}
