'use strict';

/// HEADER ::: import necessary packages.
const {remote} = require('electron');
const {Menu, MenuItem} = remote;
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const Editor = require('@toast-ui/editor');
const Checker = require('./checker').Checker;
const watch = require("node-watch");

/// HEADER ::: Declare class instance to use 
let watcher = null;
let checker = new Checker();

// VARAIBLE ::: Root direoctry given by user as a root for recursive file detection.
let rootDirectory = null;
// VARAIBLE ::: Total list of gdml files's object 
// {path : string, status: string}
let totalGdmlList = new Array();

// VARAIBLE ::: Array that stores object of following properties
// {status: string, manualSave: boolean, path: string, content: string(yaml), screen: domElement, tab: domElement, editor: ToastEditorInstance}
let tabObjects = new Array(); // This is list of opened tabs's which has a data of yaml string

// VARAIBLE ::: Index that points to the currentTabObject
// when no tabs are open then tabIndex is -1
// This gets reset to -1 when new root directory is loaded.
let currentTabIndex = -1;

// VARAIBLE ::: Consts values for prevention of wrong strings
const OUTDATED = "OUTDATED";
const UPTODATE = "UPTODATE";
const UNSAVED ="UNSAVED";
const SAVED ="SAVED";

const UNSAVEDSYMBOL = "+";

// VARAIBLE ::: COLOR value is based on tailwind-css class names
const UNDEFINEDCOLOR = "bg-gray-700";
const HIGHLIGHT ="bg-gray-200";
const NORMALBG = "bg-white";
const OUTDATEDCOLOR = "bg-red-500";
const UPTODATECOLOR = "bg-blue-500";

// VARAIBLE ::: Caching of specific dom elements.
const tabMenu = document.querySelector("#openedTabs");
const sideMenu = document.querySelector('#menuContents');
const mainDiv = document.querySelector("#main");
const statusDiv = document.querySelector("#statusBar");
const refDiv = document.querySelector("#references");
const editorScreen = document.querySelector("#editorScreen");
editorScreen.style.display = "none";

// INITIATION ::: Set electron menu and local shortcut for file navigations.
const menu = new Menu()
menu.append(new MenuItem({
  label: 'File',
  submenu: [{
    label: 'Open Directory',
    accelerator: process.platform === 'darwin' ? 'Cmd+O' : 'Control+O',
    click: () => { document.querySelector("#openDirBtn").click(); }
  },{
    label: 'Save File',
    accelerator: process.platform === 'darwin' ? 'Cmd+S' : 'Control+S',
    click: () => { document.querySelector("#saveFileBtn").click(); }
  },{
    label: 'Check dependencies',
    accelerator: process.platform === 'darwin' ? 'Cmd+R' : 'Control+R',
    click: () => { document.querySelector("#checker").click(); }
  }
  ]
}))
Menu.setApplicationMenu(menu)

// EVENT ::: Make Checker object and add all gdml documents as NodeInstance to checkerinstance
document.querySelector("#checker").addEventListener('click', () => {

	if (rootDirectory === null) return;

	// If unsaved tab exists dependency check cannot happen
	// TODO ::: If unsaved tabObjects exist then return and show dialog that it is not availble;
	var checkUnsaved = false;
	tabObjects.forEach((tab) => {
		if (tab.status === UNSAVED) checkUnsaved = true;
	})
	if ( checkUnsaved ) {
		alert("Unsaved tab exists cannot check dependencies");
		return;
	}

	// Make NodeObject from totalGdmlList's item's
	for (var i = 0, len = totalGdmlList.length; i < len; i++) {
		let gdml = loadGdml(totalGdmlList[i].path);
		if (gdml == null) {
			console.error("GDML IS null;");
			return;
		}
		try {
			checker.addNode(totalGdmlList[i].path, gdml["reference"]);
		} catch (e) {
			alert("Mutual reference detected from file.\n" + e);
			return;
		}
	}

	let checkerList = checker.getLevelSortedList();
	checker.checkDependencies(checkerList);

	console.log("Given list");
	console.log(checkerList);
	// Sort both checkerList and totlaGdmlList by path(value).
	// Order is not important, becuase two list will always have same list of paths. 
	totalGdmlList.sort((a,b) => {
		if ( a.path < b.path ){
			return -1;
		}
		if ( a.path > b.path ){
			return 1;
		}
		return 0;
	});
	checkerList.sort((a,b) => {
		if ( a.value < b.value ){
			return -1;
		}
		if ( a.value > b.value ){
			return 1;
		}
		return 0;
	});

	// TODO ::: Should change statuses of menu buttons 
	// Should change statues of opened tabs
	for (var i = 0, len = totalGdmlList.length; i < len; i++) {
		console.log("Checking  ----- ");
		console.log(totalGdmlList[i]);
		console.log("With ----- ");
		console.log(checkerList[i]);
		// If Status has changed after dependency check, apply changes to file
		// With this approcah caching(memory usage) is minified and I/O is maximized.
		if (totalGdmlList[i].status !== checkerList[i].status) {
			let readFile = yaml.load(fs.readFileSync(totalGdmlList[i].path));
			readFile["status"] = checkerList[i].status;
			fs.writeFileSync(totalGdmlList[i].path, yaml.safeDump(readFile), 'utf8');
		}
	}
	alert("Checked dependencies successfully");
});

// EVENT ::: Save markdown of tabObject into the file which path is associated with tabObject.
document.querySelector('#saveFileBtn').addEventListener('click', () => {
	// if there is tab to save then return;
	if (tabObjects.length === 0) return;
	// Get currentTabObject for easy reading
	let currentTabObject = tabObjects[currentTabIndex];
	if(currentTabObject.status !== UNSAVED) return; // if file is not unsaved then skip operation

	// Update content body with editor's content
	currentTabObject.content["body"] = currentTabObject.editor.getMarkdown();
	// set status to saved because it is getting saved. It is ok to preset status 
	currentTabObject.status = SAVED;

	// If not manualSave directrly save without further procedure
	if (!currentTabObject.manualSave) {
		fs.writeFileSync(currentTabObject.path, yaml.safeDump(currentTabObject.content), 'utf8');
		alert("Saved successfully");
	} 
	// If manualSave is true then show showSaveDialog to enable user's arbitrary file name.
	else {
		remote.dialog.showSaveDialog(remote.getCurrentWindow(), {defaultPath: currentTabObject.path}).then((response) => {
			if(!response.canceled) {
				fs.writeFileSync(response.filePath, yaml.safeDump(currentTabObject.content), 'utf8');

				// Change tabObject's value and textContent according to newly updated filePath(value)
				currentTabObject.tab.textContent = path.basename(response.filePath);
				currentTabObject.manualSave = false;
				currentTabObject.tab.dataset.path = response.filePath;
				currentTabObject.path = response.filePath;
			}
		});
	}
});

// EVENT ::: Open Dialog and set rootDirectory
document.querySelector("#openDirBtn").addEventListener('click', (event) => {
	remote.dialog.showOpenDialog(remote.getCurrentWindow(),{defaultPath: __dirname, properties: ["openDirectory"]}).then((response) => {
		if(!response.canceled) {
			// Reset gdml List
			totalGdmlList = new Array();
			setRootDirectory(response.filePaths[0]);
		}
	});
});

// TODO ::: Completely remove current tabObjects list.
// FUNCTION ::: Set root directory and set other variables accordingly.
function setRootDirectory(directory) {
	try {
		let files = fs.readdirSync(directory);

		// Remove children of sideMenu
		while(sideMenu.firstChild) {
			sideMenu.removeChild(sideMenu.firstChild);
		}

		// Make root directory buttonish div
		var divElem = document.createElement('div');
		var dirElem = document.createElement('div');
		divElem.classList.add("border-gray-700", "border-b", "flex", "flex-col");
		dirElem.classList.add("rounded", "font-bold", "text-left", "py-2", "px-4", "text-white", UNDEFINEDCOLOR, "m-2");
		dirElem.textContent = "<" + path.basename(directory) + ">";
		sideMenu.appendChild(divElem);
		divElem.appendChild(dirElem);

		// Make new sideMenu buttons
		listMenuButtons(directory , files, sideMenu);
	} catch(error) {
		return console.error('Unable to scan directory: ' + error);
	}

	document.querySelector("#helpText").style.display = "none";

	// If user is opening new root directory
	// Remove all existing tabObjects, directory related variables
	// TODO ::: Check this code, hightly prone to errors
	if (rootDirectory !== directory && rootDirectory !== null) {

		// Reset tabObjects
		tabObjects.forEach((tabObject) => {
			tabObject.tab.remove();
			tabObject.screen.remove();
		});
		tabObjects = new Array();
		currentTabIndex = -1;

		// Reset statusdiv's color by removing class from classList
		statusDiv.classList.remove(OUTDATEDCOLOR);
		statusDiv.classList.remove(UPTODATECOLOR);
		statusDiv.classList.remove(UNDEFINEDCOLOR);
		statusDiv.textContent = "";
		statusDiv.style.display = "none";
	} 
	// If reopening same rootDirectory then check if tabObjects are still valid
	else {
		tabObjects.forEach((tabObject) => {
			// File associated to tabObject now doesn't exist
			if (!fs.existsSync(tabObject.path)) {
				// Set status to unsaved
				// If savefile is called then new file will be created without collision.
				tabObject.status = UNSAVED;
				tabObject.tab.textContent = path.basename(tabObject.path) + UNSAVEDSYMBOL;
			}
			// File still exists
			else {
				// If file has changed 
				// load changed file contents
				let readContent = yaml.load(fs.readFileSync(tabObject.path));
				// Compare contents of read file and editor's contents
				if (readContent !== tabObject.content) {
					// If editor is unsaved
					// Set to manualSave so that user can save to another file
					if (tabObject.status === UNSAVED) {
						tabObject.manualSave = true;
						tabObject.tab.textContent = path.basename(tabObject.path) + UNSAVEDSYMBOL;
					} 
					// If editor content is not "unsaved"
					// just copy file contents to editor
					else {
						tabObject.content = readContent;
						tabObject.editor.setMarkdown(readContent["body"], false);
					}
				}
			}
		})
	}
	// Update root directory
	rootDirectory = directory;	

	// If watch already exists then it means that it is not the first time function called.
	// remove prior watcher and all listmenuButtons's children;
	if (watcher !== null) {
		// Remove watcher
		watcher.close();
		watcher = null;
	}

	// Set new file watcher for root direoctory
	watcher = watch(rootDirectory, {recurisve: true}, (evt, name) => {
		// If changed file is gdml then reload the whole project
		if (path.extname(name).toLowerCase() === ".gdml") {
			setRootDirectory(rootDirectory);
		}
	});
}

// SOURCE ::: https://stackoverflow.com/questions/12997123/print-specific-part-of-webpage/#answer-12997207
// FUNCTION ::: Print editor content into file
document.querySelector("#printBtn").addEventListener('click', (event) => {
	if (currentTabIndex === -1) return; // if there is no file to print then return.
	tabObjects[currentTabIndex].editor.changeMode('wysiwyg');
	let editorHtml = tabObjects[currentTabIndex].screen.querySelector(".te-editor-section").outerHTML;
	let WinPrint = window.open('', 'modal', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
	WinPrint.document.write(editorHtml);
	WinPrint.document.write('<link rel="stylesheet" href="node_modules/codemirror/lib/codemirror.css"/><link rel="stylesheet" href="node_modules/@toast-ui/editor/dist/toastui-editor.css"/><link rel="stylesheet" href="styles.css" type="text/css" media="screen" title="no title" charset="utf-8">');
	//WinPrint.document.write('<link rel="stylesheet" href="node_modules/@toast-ui/editor/dist/toastui-editor.css"/>');
	//WinPrint.document.write('<link rel="stylesheet" href="styles.css" type="text/css" media="screen" title="no title" charset="utf-8">');
	WinPrint.document.close();
	// Content is not rendered immediately so waiting is required.
	WinPrint.setTimeout(function(){
      WinPrint.focus();
      WinPrint.print();
      WinPrint.close();
    }, 1000);
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
	//
	// Make root directory 

	// Iterate over read files from directory
	files.forEach(function (file) {
		let fullPath = path.join(root, file);
		// if file is gdml file then make file button
		if (path.extname(fullPath).toLowerCase() === ".gdml") {
			listFile(root, file, parentElement);
		} 
		// if file is directory then make directory button 
		else if (fs.lstatSync(fullPath).isDirectory()) {
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
	divElem.classList.add("border-gray-700", "border-t", "border-b", "flex", "flex-col");
	dirElem.classList.add("rounded", "font-bold", "text-left", "py-2", "px-4", "text-white", UNDEFINEDCOLOR, "m-2");
	let fullPath = path.join(root, dirName);
	dirElem.textContent = "↓" + dirName;
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

// FUNCTION ::: Simply load gdml from filePath and return as string
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

	// TODO ::: If tab is already open then copy tab data into editorInstance.
	// Load file from fs 
	let filePath = event.currentTarget.dataset.path;
	let tabIndex = isTabPresent(filePath);

	// If file is already open thus tab exists
	if(tabIndex !== -1){
		// Hide current tab
		hideCurrentTab();

		// Change currentTabIndex
		currentTabIndex = tabIndex;
		// And show selected tab
		tabObjects[currentTabIndex].screen.style.display = "";
		tabObjects[currentTabIndex].tab.parentElement.classList.add(HIGHLIGHT);
		tabObjects[currentTabIndex].tab.parentElement.classList.remove(NORMALBG);
		// Update Status Bar
		statusGraphics(tabObjects[currentTabIndex].content["status"]);
		// TODO ::: COMPLETE THIS
		listReferences();
		return;
	}

	// When tab is opened and user is trying to open another tab with another file
	// Hide currently visible tab.
	if(currentTabIndex != -1) {
		hideCurrentTab();
	} // else if tab is not opened at all don't have to hide anything.


	// If not tab is open, then read file and paset data into newly created editor. 
	fs.readFile(filePath, 'utf8', (err, data) => {
		if (err) {
			alert("Failed to read file");
			return;
		}
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

		// If editor's content changes and content is different from original one
		// then set status to unsaved.
		// Also change tab's name to somewhat distinguishable.
		editorInstance.on("change", () => {
			let currentTab = tabObjects[currentTabIndex];
			if (currentTab.content["body"] !== currentTab.editor.getMarkdown()) {
				currentTab.status = UNSAVED;
				currentTab.tab.textContent = path.basename(currentTab.path) + UNSAVEDSYMBOL;
			} else { // both contents are same
				currentTab.status = SAVED;
				currentTab.tab.textContent = path.basename(currentTab.path);
			}
		});

		// Add new Tab 
		let newTab = addNewTab(filePath);
		tabObject.tab = newTab;

		// TODO ::: Make this work 
		// referenceDiv.style.display= "";
		statusDiv.style.display = "";
		tabObjects[currentTabIndex].tab.parentElement.classList.add(HIGHLIGHT);
		tabObjects[currentTabIndex].tab.parentElement.classList.remove(NORMALBG);

		statusGraphics(tabObjects[currentTabIndex].content["status"]);
		// TODO ::: COMPLETE THIS
		listReferences();
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
	let divElem = document.createElement('div');
	let btnElem = document.createElement('button');

	divElem.classList.add("blankButton", "bg-white");

	btnElem.dataset.path = filePath;
	btnElem.textContent = path.basename(filePath);
	btnElem.addEventListener('click', loadGdmlToEditor);

	// TODO :: Make close button
	let closeButton = document.createElement('button');
	let iconElement = document.createElement('i');
	iconElement.classList.add("fas", "fa-times", "pl-1");
	closeButton.addEventListener('click', (event) => {
		// Get parent target and close
		// Also stop propagation so that clicking parent button should not be triggered.
		closeTab();
		event.stopPropagation();
	});

	closeButton.append(iconElement);
	divElem.appendChild(btnElem);
	divElem.appendChild(closeButton);
	tabMenu.appendChild(divElem);

	return btnElem;
}

function closeTab() {
	let currentTabObject = tabObjects[currentTabIndex];
	currentTabObject.tab.parentElement.remove();
	currentTabObject.screen.remove();
	removeRef();

	// Delete tabObject from array
	tabObjects.splice(currentTabIndex, 1);
	statusDiv.style.display="none";

	// if other tabs are exsiting
	if (tabObjects.length !== 0) {
		if (currentTabIndex - 1 > -1) {
			currentTabIndex -= 1;
		}
		// Show prior tab
		tabObjects[currentTabIndex].screen.style.display = "";
		tabObjects[currentTabIndex].tab.parentElement.classList.add(HIGHLIGHT);
		tabObjects[currentTabIndex].tab.parentElement.classList.remove(NORMALBG);
		// Update Status Bar
		statusDiv.style.display="block";

		statusGraphics(tabObjects[currentTabIndex].content["status"]);
		// TODO ::: COMPLETE THIS
		listReferences();
	} 
	// Tab object's length is 0 so reset tabIndex to -1
	else {
		currentTabIndex = -1;
	}
}


// FUNCTION ::: Toggle children elements of directory menu button
function toggleChildren(event) {
	let children = event.currentTarget.parentElement.querySelectorAll(".fileButton");
	children.forEach((child) => {
		// If not folded then fold
		if (child.style.display === "none") {
			event.currentTarget.textContent = "↓" +path.basename(event.currentTarget.dataset.path);
			child.style.display = "block";
		} 
		// if folded then unfold
		else {
			event.currentTarget.textContent = "| " +path.basename(event.currentTarget.dataset.path);
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

// TODO ::: MAke this work
function listReferences() {
	// get list of referecnes from the tabObject 
	let references = tabObjects[currentTabIndex].content["reference"]; // This is array

	references.forEach((ref) => {
		var elem = document.createElement('button');
		let filePath = ref;

		let fileYaml = yaml.load(fs.readFileSync(ref)); // this should not fail becuase it was read from readdirSync
		let menuColor = UNDEFINEDCOLOR; // Undefined color
		if (fileYaml["status"] == OUTDATED) menuColor = OUTDATEDCOLOR;
		else menuColor = UPTODATECOLOR;

		elem.textContent = path.basename(filePath);
		elem.dataset.path = filePath;
		elem.addEventListener('click', loadGdmlToEditor);
		elem.classList.add("blankButton", menuColor, "mx-2", "w-full");
		refDiv.appendChild(elem);
	});
}

// TODO ::: Make this work
function hideCurrentTab() {
	// Hide screen and toggle color of tab Object
	tabObjects[currentTabIndex].screen.style.display = "none";
	tabObjects[currentTabIndex].tab.parentElement.classList.remove(HIGHLIGHT);
	tabObjects[currentTabIndex].tab.parentElement.classList.add(NORMALBG);

	// Remove all ref Div's child elements
	removeRef();
}

function removeRef() {
	while(refDiv.firstChild) {
		refDiv.removeChild(refDiv.firstChild);
	}
}
