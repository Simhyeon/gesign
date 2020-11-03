'use strict';

/// HEADER
const { remote } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const Editor = require('@toast-ui/editor');
const Checker = require('./checker').Checker;
const watch = require("node-watch");

let watcher = null;
let checker = new Checker();

// COMMENTS
// IMPORTANT NOTE !!! 
// TODO ::: Change to initilize only editor div not a whole editorScreen so that status can be displayed 

// VARAIBLE ::: Root direoctry given by user as a root for recursive file detection.
let rootDirectory;
// VARAIBLE ::: Total list of gdml files's paths + dependencies
let totalGdmlList = new Array();

// VARAIBLE ::: Array that stores object of following properties
// TODO ::: Should add current file Status
// Like Unsaved, Deleted, Or None for default
// {path: string, content: string(yaml), screen: domElement, editor: ToastEditorInstance}
// TODO ::: Should be something like 
// {status: string, manualSave: boolean, path: string, content: string(yaml), screen: domElement, tab: domElement, editor: ToastEditorInstance}
let tabObjects = new Array(); // This is list of opened tabs's which has a data of yaml string

// VARAIBLE ::: Index that points to the currentTabObject
// when no tabs are open then tabIndex is -1
let currentTabIndex = -1;

// VARAIBLE ::: Consts values
const OUTDATED = "OUTDATED";
const UPTODATE = "UPTODATE";
const UNDEFINEDCOLOR = "bg-gray-500";
const OUTDATEDCOLOR = "bg-red-300";
const UPTODATECOLOR = "bg-blue-300";
const UNSAVED ="UNSAVED";
const SAVED ="SAVED";

// VARAIBLE ::: Caching of specific dom elements.
const tabMenu = document.querySelector("#openedTabs");
const sideMenu = document.querySelector('#menuContents');
const mainDiv = document.querySelector("#main");
const statusDiv = document.querySelector("#statusBar");
const editorScreen = document.querySelector("#editorScreen");
editorScreen.style.display = "none";

// EVENT || DEBUG ::: Make Checker object and add all gdml document sto graph node
document.querySelector("#checker").addEventListener('click', () => {
	// If unsaved tab exists dependency check cannot happen
	var checkUnsaved = false;
	tabObjects.forEach((tab) => {
		if (tab.status === UNSAVED) checkUnsaved = true;
	})
	if ( checkUnsaved ) return;

	// TODO ::: If unsaved tabObjects exist then return and show dialog that it is not availble;
	totalGdmlList.forEach((object) => {
		let gdml = loadGdml(object.path);
		if (gdml == null) {
			console.error("GDML IS null;");
			return;
		}
		checker.addNode(object.path, gdml["reference"]);
	})

	//checker.debugPrintAll();
	let checkerList = checker.getLevelSortedList();
	//console.log(sortedList);
	checker.checkDependencies(checkerList);
	//console.log("After dependency check");
	//console.log(sortedList);

	// Sort both checkerList and totlaGdmlList by string.
	// Order is not important, becuase two list will always have two same list of paths. 
	totalGdmlList.sort((a,b) => {
		return a-b;	
	});
	checkerList.sort((a,b) => {
		return a-b;
	});
	console.log("Length of both list should be equal which is : " + totalGdmlList.length + " / " + checkerList.length);

	// TODO ::: Should change statuses of menu buttons 
	// Should change statues of opened tabs
	for (var i = 0, len = totalGdmlList.length; i < len; i++) {
		// Status has changed after dependency check
		if (totalGdmlList[i].status !== checkerList[i].status) {
			console.log("Adding new check status to : " + totalGdmlList[i].path);
			let readFile = yaml.load(fs.readFileSync(totalGdmlList[i].path));
			readFile["status"] = checkerList[i].status;
			fs.writeFileSync(totalGdmlList[i].path, yaml.safeDump(readFile), 'utf8');
		}
	}

	alert("Checked dependencies successfully");
});

// EVENT ::: Save markdown of tabObject into the file which path is associated with tabObject.
document.querySelector('#saveFileBtn').addEventListener('click', () => {
	let currentTabObject = tabObjects[currentTabIndex];
	if(currentTabObject.status !== UNSAVED) return; // if file is not unsaved then skip operation

	currentTabObject.content["body"] = currentTabObject.editor.getMarkdown();
	currentTabObject.status = SAVED;
	if (!currentTabObject.manualSave) {
		fs.writeFileSync(currentTabObject.path, yaml.safeDump(currentTabObject.content), 'utf8');
		alert("Saved successfully");
	} else {
		remote.dialog.showSaveDialog(remote.getCurrentWindow(), {defaultPath: currentTabObject.path}).then((response) => {
			if(!response.canceled) {
				console.log(response);
				fs.writeFileSync(response.filePath, yaml.safeDump(currentTabObject.content), 'utf8');
				currentTabObject.tab.textContent = path.basename(response.filePath);
				currentTabObject.manualSave = false;
				currentTabObject.tab.dataset.path = response.filePath;
				currentTabObject.path = response.filePath;
			}
		});
	}
});

// EVENT ::: Open Dialog and set rootDirectory
document.querySelector("#openDirBtn").addEventListener('click', () => {
	remote.dialog.showOpenDialog(remote.getCurrentWindow(),{defaultPath: __dirname, properties: ["openDirectory"]}).then((response) => {
		if(!response.canceled) {
			// Reset gdml List
			totalGdmlList = new Array();
			setRootDirectory(response.filePaths[0]);
		}
	});
});

// TODO ::: Completely remove current tabObjects list.
function setRootDirectory(directory) {
	try {
		let files = fs.readdirSync(directory);

		// Remove children of sideMenu
		while(sideMenu.firstChild) {
			sideMenu.removeChild(sideMenu.firstChild);
		}

		listMenuButtons(directory , files, sideMenu);
	} catch(error) {
		return console.error('Unable to scan directory: ' + error);
	}

	// Opening new root directory
	// Remove all existing tabObjects
	// TODO ::: Check this code
	if (rootDirectory !== directory && rootDirectory !== null) {
		console.log("root directory has changed");
		tabObjects.forEach((tabObject) => {
			tabObject.tab.remove();
			tabObject.screen.remove();
		});
	} 
	// If reopening tabs then check if tabObjects are still valid
	else {
		tabObjects.forEach((tabObject) => {
			// File now doesn't exists
			if (!fs.existsSync(tabObject.path)) {
				tabObject.status = UNSAVED;
				tabObject.tab.textContent = path.basename(tabObject.path) + "*";
			}
			// File exists
			else {
				console.log("Existing file tab detected");
				// If file has changed 
				let readContent = yaml.load(fs.readFileSync(tabObject.path));
				console.log("Read Content is :");
				console.log(readContent);
				console.log("Current tabObject is :" );
				console.log(tabObject.content);
				if (readContent !== tabObject.content) {
					// If editor is unsaved
					if (tabObject.status === UNSAVED) {
						tabObject.manualSave = true;
						tabObject.tab.textContent = path.basename(tabObject.path) + "*";
					} 
					// If editor content is uptodate
					else {
						tabObject.content = readContent;
						tabObject.editor.setMarkdown(readContent["body"], false);
					}
				}
			}
		})
	}
	rootDirectory = directory;	

	// If watch already exists then it means that setRootDirectory is called multiple times
	// remove prior watcher and all listmenuButtons's children;
	if (watcher !== null) {
		// Remove watcher
		watcher.close();
		watcher = null;
	}

	// Set file watcher for root direoctory
	watcher = watch(rootDirectory, {recurisve: true}, (evt, name) => {
		// If changed file is gdml and reload the whole project
		if (path.extname(name).toLowerCase() === ".gdml") {
			console.log("File changed reloading root directory");
			setRootDirectory(rootDirectory);
		}
	});
}

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

	let fullPath = path.join(root , fileName);
	let fileYaml = yaml.load(fs.readFileSync(fullPath)); // this should not fail becuase it was read from readdirSync
	let menuColor = UNDEFINEDCOLOR; // Undefined color
	if (fileYaml["status"] == OUTDATED) menuColor = OUTDATEDCOLOR;
	else menuColor = UPTODATECOLOR;

	elem.textContent = fileName;
	elem.dataset.path = fullPath;
	elem.addEventListener('click', loadGdmlToEditor);
	elem.classList.add("rounded", "font-bold", "text-left", "py-2", "px-4", "text-white", menuColor, "fileButton", "m-2");
	parentElement.appendChild(elem);
	// Add value to array(list) so that dependency checker can do his job.
	totalGdmlList.push({ path: fullPath, status: fileYaml["status"]});
}

// FUNCTION ::: Create directory menu button
function listDirectory(root, dirName, parentElement) {
	var divElem = document.createElement('div');
	var dirElem = document.createElement('button');
	dirElem.classList.add("rounded", "font-bold", "text-left", "py-2", "px-4", "text-white", UNDEFINEDCOLOR, "m-2");
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
		let result = fs.readFileSync(filePath);
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
	console.log("Clicked side menu");
	console.log("Filepath is : " + filePath);
	console.log("Is tab already present ? :" + tabIndex);

	if(tabIndex !== -1){
		// Hide current tab
		tabObjects[currentTabIndex].screen.style.display = "none";

		// Change currentTabIndex
		currentTabIndex = tabIndex;
		// And show selected tab
		tabObjects[currentTabIndex].screen.style.display = "";
		// Update Status Bar
		statusGraphics(tabObjects[currentTabIndex].content["status"]);
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
		var tabObject = {status: SAVED, manualSave: false, path: filePath, content: yaml.load(data), screen: editorScreenElem, tab: null, editor: editorInstance};
		tabObjects.push(tabObject);

		editorInstance.setMarkdown(tabObject.content["body"], false);
		// DEBUG ::: Testing onchange event
		editorInstance.on("change", () => {
			let currentTab = tabObjects[currentTabIndex];
			if (currentTab.content["body"] !== currentTab.editor.getMarkdown()) {
				currentTab.status = UNSAVED;
				currentTab.tab.textContent = path.basename(currentTab.path) + "*";
			} else { // both contents are same
				currentTab.status = SAVED;
				currentTab.tab.textContent = path.basename(currentTab.path);
			}
		});
		statusGraphics(tabObjects[currentTabIndex].content["status"]);
		// TODO ::: NOT YET READY
		let newTab = addNewTab(filePath);
		tabObject.tab = newTab;
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
	return btnElem;
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
function statusGraphics(statusString) {
	if( statusString === "UPTODATE" ) {
		statusDiv.textContent = "Up to date";
		statusDiv.classList.remove(UNDEFINEDCOLOR);
		statusDiv.classList.remove(OUTDATEDCOLOR);
		statusDiv.classList.add(UPTODATECOLOR);
	} else if (statusString === "OUTDATED") {
		statusDiv.textContent = "Outdated";
		statusDiv.classList.remove(UNDEFINEDCOLOR);
		statusDiv.classList.add(OUTDATEDCOLOR);
		statusDiv.classList.remove(UPTODATECOLOR);
	} else if (statusString === "INDEFINITE") {
		statusDiv.textContent = "Indefinte";
		statusDiv.classList.add(UNDEFINEDCOLOR);
		statusDiv.classList.remove(OUTDATEDCOLOR);
		statusDiv.classList.remove(UPTODATECOLOR);
	}
}

// FUNCTION ::: Reload tabs when loading root directory
function reloadTabs() {

}
