'use strict';

/// HEADER ::: import necessary packages.
const {remote} = require('electron');
const {Menu, MenuItem} = remote;
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const Editor = require('@toast-ui/editor');
const checker = require("./checker");
const {Checker} = require('./checker');
const watch = require("node-watch");
const _ = require("lodash");
const cli = require("./cli");
const gdml = require('./gdml');
const {Config} = require("./config");
const {FileTree} = require("./filetree");
const CliOption = cli.CliOption;

/// HEADER ::: Declare class instance to use 
let watcher = new Array();
let prevFileTree = null;
let fileTree = null;

// VARAIBLE ::: Root direoctry given by user as a root for recursive file detection.
let rootDirectory = null;
// VARAIBLE ::: Total list of gdml files's object 
// {path : string, status: string}
let totalGdmlList = new Array();

// VARAIBLE ::: Array that stores object of following properties
// {temp : boolean, contentStatus: string, refStatus: String , resetted: boolean ,manualSave: boolean, path: string, refs: [], content: string(yaml),meta: domElement ,screen: domElement, tab: domElement, editor: ToastEditorInstance}
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
const HIGHLIGHT = "bg-white"; 
const NORMALBG = "bg-gray-300";
const OUTDATEDCOLOR = "bg-red-500";
const UPTODATECOLOR = "bg-blue-500";
// BREAKABLE ::: This is really hard code and may breakble in later releases of toast ui editor.
const FONTCLASSES= ".CodeMirror-lines, .tui-editor-contents";

// VARAIBLE ::: Caching of specific dom elements.
const tabMenu = document.querySelector("#openedTabs");
const sideMenu = document.querySelector('#menuContents');
const mainDiv = document.querySelector("#main");
// const statusDiv = document.querySelector("#statusBar"); // This should be accessed from metaBar
// const refDiv = document.querySelector("#references");
const metaBar = document.querySelector("#metaBar");
const editorScreen = document.querySelector("#editorScreen");

// VARAIBLE ::: Config class
let config = new Config();
// ----------------------------------------------------------------------------
// INITIATION ::: Execute multiple initiation operation. 
// Editorscreen should not be displayed but cloned and then set visible.
metaBar.style.display = "none";
editorScreen.style.display = "none";
// Set electron menu and local shortcut for file navigations.
const menu = new Menu()
menu.append(new MenuItem({
  label: 'Menu',
  submenu: [{
    label: 'Open Directory',
    accelerator: process.platform === 'darwin' ? 'Cmd+Shift+O' : 'Control+Shift+O',
    click: () => { document.querySelector("#openDirBtn").click(); }
  },{
	  label: 'New File',
	  accelerator: process.platform === 'darwin' ? 'Cmd+Shift+N' : 'Control+Shift+N',
	  click: () => { document.querySelector("#addNewDocument").click(); }
  }, {
    label: 'Save File',
    accelerator: process.platform === 'darwin' ? 'Cmd+Shift+S' : 'Control+Shift+S',
    click: () => { saveFile() }
  },{
    label: 'Check dependencies',
    accelerator: process.platform === 'darwin' ? 'Cmd+Shift+R' : 'Control+Shift+R',
    click: () => { document.querySelector("#checker").click(); }
  },{
    label: 'Toggle Mode',
    accelerator: process.platform === 'darwin' ? 'Cmd+Shift+M' : 'Control+Shift+M',
    click: () => { toggleMode() }
  }
  ]
}))
Menu.setApplicationMenu(menu)
let givenDirectory = remote.process.cwd();
// ----------------------------------------------------------------------------

// VARAIBLE ::: Cli option related 
cli.init(remote.process.argv);
let dirOption = new CliOption("-d", "--dir", setRootDirectory, null);
let argIndex = cli.getFlagArgIndex(dirOption); 
if (argIndex !== null) {
	dirOption.actionArg = remote.process.argv[argIndex];
}
// Execute render window related cli options' corresponding functions(closure).
cli.execFlagAction(dirOption);

// EVENT ::: Add new Document to tab
document.querySelector("#addNewDocument").addEventListener('click', () => {

	if (rootDirectory == null) return;

	// Hide Button
	if (tabObjects.length !== 0) {
		hideCurrentTab();
	}

	let metaElem = metaBar.cloneNode(true);
	let editorScreenElem = editorScreen.cloneNode(true);
	mainDiv.appendChild(metaElem);
	mainDiv.appendChild(editorScreenElem);
	metaElem.style.display = "";
	editorScreenElem.style.display = "";

	currentTabIndex = tabObjects.length;
	let editorInstance = initEditor("Editor_" + currentTabIndex, editorScreenElem, config.content["startMode"]);

	var tabObject = newTabObject(false, SAVED, SAVED, true, path.join(rootDirectory, 'new*.gdml'), new Set(), gdml.newGdml(), metaElem, editorScreenElem, null, editorInstance);
	// LEGACY :::  
	//var tabObject = {
		//contentStatus: SAVED, 
		//refStatus: SAVED, 
		//manualSave: true, 
		//path: path.join(rootDirectory, 'new.gdml'), 
		//refs: new Set() ,
		//content: gdml.newGdml(),
		//meta: metaElem, 
		//screen: editorScreenElem, 
		//tab: null, 
		//editor: editorInstance
	//};
	// IMPORTANT ::: push should be done before other tab related  
	// becuase other operations assume that length has changed already.
	tabObjects.push(tabObject);

	// If editor's content changes and content is different from original one
	// then set status to unsaved.
	// Also change tab's name to somewhat distinguishable.
	editorInstance.on("change", () => {
		let currentTab = tabObjects[currentTabIndex];
		if (currentTab.content["body"].trim() !== currentTab.editor.getMarkdown().trim()) {
			currentTab.contentStatus = UNSAVED;
			currentTab.tab.textContent = path.basename(currentTab.path) + UNSAVEDSYMBOL;
		} else { // both contents are same
			currentTab.contentStatus = SAVED;
			if (currentTab.refStatus === SAVED) {
				currentTab.tab.textContent = path.basename(currentTab.path);
			}
		}
	});

	// Add new Tab 
	let newTab = addNewTab("unnamed*.gdml");
	tabObject.tab = newTab;

	// Set highlight color
	tabObjects[currentTabIndex].tab.parentElement.classList.add(HIGHLIGHT);
	tabObjects[currentTabIndex].tab.parentElement.classList.remove(NORMALBG);

	// set status graphic
	statusGraphics(tabObjects[currentTabIndex].content["status"]);
	// Add drag drop event to references
	metaElem.addEventListener('dragover', (event) => {
		event.preventDefault();
	});
	metaElem.addEventListener('drop', (event) => {
		addRefBtn(event.dataTransfer.getData("text"), false);
	});
});

// EVENT ::: Make Checker object and add all gdml documents as NodeInstance to checkerinstance
document.querySelector("#checker").addEventListener('click', () => {
	checkerButton();
});

// FUNCTION ::: Called by checkerButton event
function checkerButton() {
	if (rootDirectory === null) return;

	// If unsaved tab exists dependency check cannot happen
	var checkUnsaved = false;
	tabObjects.forEach((tab) => {
		if (tab.contentStatus === UNSAVED || tab.refStatus === UNSAVED) checkUnsaved = true;
	})
	if ( checkUnsaved ) {
		alert("Unsaved tab exists cannot check dependencies");
		return;
	}

	let checker = new Checker();
	// Make NodeObject from totalGdmlList's item's
	for (let i = 0, len = totalGdmlList.length; i < len; i++) {
		let gdml = loadGdml(totalGdmlList[i].path);
		if (gdml == null) {
			console.error("GDML IS null;");
			return;
		}
		try {
			checker.addNode(totalGdmlList[i].path, gdml);
		} catch (e) {
			alert("Mutual reference detected from file.\n" + e);
			return;
		}
	}

	let checkerList = checker.checkDependencies();

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
	// In first sight it should be ok becuase fs filewatch will detect status change and will
	// read from root Directory.
	// Should change statues of opened tabs
	for (let j = 0, leng = totalGdmlList.length; j < leng; j++) {
		// If Status has changed after dependency check, apply changes to file
		// With this approcah caching(memory usage) is minified and I/O is maximized.
		if (totalGdmlList[j].status !== checkerList[j].status) {
			let readFile = yaml.load(fs.readFileSync(totalGdmlList[j].path), 'utf8');
			readFile["status"] = checkerList[j].status;
			fs.writeFileSync(totalGdmlList[j].path, yaml.safeDump(readFile), 'utf8');
		}
	}
	//alert("Checked dependencies successfully");
}

// EVENT ::: Save markdown of tabObject into the file which path is associated with tabObject.
document.querySelector('#saveFileBtn').addEventListener('click', () => {
	saveFile();
});

// FUNCTION ::: Save file of current tab
function saveFile() {
	// if there is tab to save then return;
	if (tabObjects.length === 0) return;
	// Get currentTabObject for easy reading
	let currentTabObject = tabObjects[currentTabIndex];
	console.log(currentTabObject);
	if(currentTabObject.contentStatus !== UNSAVED && currentTabObject.refStatus !== UNSAVED) return; // if file is not unsaved then skip operation

	// Update content body with editor's content
	currentTabObject.content["lastModified"] = Date.now();
	currentTabObject.content["body"] = currentTabObject.editor.getMarkdown().trim();
	currentTabObject.content["reference"] = Array.from(currentTabObject.refs);
	// If not manualSave directrly save without further procedure
	if (!currentTabObject.manualSave) {
		fs.writeFileSync(currentTabObject.path, yaml.safeDump(currentTabObject.content), 'utf8');

		// set status to saved because it is getting saved. 
		currentTabObject.contentStatus = SAVED;
		currentTabObject.refStatus = SAVED;
		currentTabObject.tab.textContent = path.basename(currentTabObject.path);
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

				// set status to saved because it is getting saved.
				currentTabObject.contentStatus = SAVED;
				currentTabObject.refStatus = SAVED;
				currentTabObject.tab.textContent = path.basename(currentTabObject.path);
			}
		});
	}

	// If config is set to check references on save check references;
	// This might not? work as expected according to asynchronous file watch logics.
	if (config.content["checkOnSave"]) checkerButton();
}

// EVENT ::: Open Dialog and set rootDirectory
document.querySelector("#openDirBtn").addEventListener('click', () => {
	let newDirectory = rootDirectory;
	if (rootDirectory === null) newDirectory = givenDirectory
	remote.dialog.showOpenDialog(remote.getCurrentWindow(),{defaultPath: newDirectory, properties: ["openDirectory"]}).then((response) => {
		if(!response.canceled) {
			// Reset gdml List
			setRootDirectory(response.filePaths[0]);
		}
	});
});

// FUNCTION ::: Set root directory and set other variables accordingly.
function setRootDirectory(directory) {

	// if path is relative then it is called with --dir flag thus making 
	// joining with process.cwd() is alright.
	if (!path.isAbsolute(directory)) {
		directory = path.join(remote.process.cwd(), directory);
	}
	totalGdmlList = new Array();

	// local Variable used later.
	let doFoldDirectory = true;
	let files;

	try {
		files = fs.readdirSync(directory);
		// Set directory's config file to current directory's config if exists.
		config.readFromFile(path.join(directory, "gesign_config.json"));
		// Change font size according to font size
		setFontSize();

		// Remove children of sideMenu
		while(sideMenu.firstChild) {
			sideMenu.removeChild(sideMenu.firstChild);
		}

		// Make root directory buttonish div
		var divElem = document.createElement('div');
		var dirElem = document.createElement('div');
		divElem.classList.add("border-gray-700", "border-b", "flex", "flex-col");
		dirElem.classList.add("font-bold", "text-left", "py-2", "px-4", "text-white", UNDEFINEDCOLOR, "my-1");
		dirElem.textContent = "<" + path.basename(directory) + ">";
		sideMenu.appendChild(divElem);
		divElem.appendChild(dirElem);

		// Set variable that decided whether fold or not.
		doFoldDirectory = (rootDirectory === null || rootDirectory !== directory);

		// If watch already exists then it means that it is not the first time function called.
		// remove prior watcher and all listmenuButtons's children;
		// TODO :: MAke this watcher list and close all watcher lists.
		if (watcher.length !== 0) {
			// Remove watcher
			watcher.forEach(item => {
				item.close();
			});
			watcher = new Array();
		}

	} catch(error) {
		return console.error('Unable to scan directory: ' + error);
	}

	// Disable Help text on startup
	document.querySelector("#helpText").style.display = "none";

	// If user is opening new root directory
	// Remove all existing tabObjects, directory related variables
	// TODO ::: Check this code, hightly prone to errors
	if (rootDirectory !== directory && rootDirectory !== null) {

		// Reset tabObjects
		tabObjects.forEach((tabObject) => {
			tabObject.tab.remove();
			tabObject.meta.remove();
			tabObject.screen.remove();
		});
		tabObjects = new Array();
		currentTabIndex = -1;
	} 
	// If reopening same rootDirectory then check if tabObjects are still valid
	else {
		tabObjects.forEach((tabObject) => {
			// File associated to tabObject now doesn't exist
			if (!fs.existsSync(tabObject.path)) {
				// Set status to unsaved
				// If savefile is called then new file will be created without collision.
				tabObject.contentStatus = UNSAVED;
				tabObject.tab.textContent = path.basename(tabObject.path) + UNSAVEDSYMBOL;
			}
			// File still exists
			else {
				// TODO ::: Make this part work with references
				// If file has changed 
				// load changed file contents
				let readContent = yaml.load(fs.readFileSync(tabObject.path), 'utf8');
				// Compare contents of read file and editor's contents
				if (readContent !== tabObject.content) {
					// If editor is unsaved
					// Set to manualSave so that user can save to another file
					if (tabObject.contentStatus === UNSAVED || tabObject.refStatus === UNSAVED) {
						tabObject.manualSave = true;
						tabObject.tab.textContent = path.basename(tabObject.path) + UNSAVEDSYMBOL;
					} 
					// If editor content is not "unsaved"
					// just copy file contents to editor
					else {
						// TODO ::: THIS might be bloat, however this app is bloat anyway.
						// Reason why checking equality before setting, although it looks redundant
						// is that pasting makes cursor to move to start area which is not an ideal
						// experience for end users.
						if (tabObject.editor.getMarkdown().trim() !== readContent["body"].trim()) {
							tabObject.content = readContent;
							tabObject.editor.setMarkdown(readContent["body"], false);
						}

						// Get References from list
						readContent["reference"].forEach((ref) => {
							if (!tabObject.refs.has(ref)) {
								addRefBtn(ref, true);
							}
						});

						tabObject.refs = new Set(readContent["reference"]);
					}

					statusGraphics(readContent["status"]);
				}
			}
		})
	}

	// Update root directory
	rootDirectory = directory;	

	// DEBUG ::: 
	// Cache fileTree becuase retaining fold status
	// Requires previous fold status from previous FileTree
	// Such process can be optimized by ignoring folding check when root directory has changed.
	prevFileTree = fileTree;
	fileTree = new FileTree(rootDirectory);
	console.log(prevFileTree);
	console.log(fileTree);
	//console.log(JSON.parse(JSON.stringify(prevFileTree)));
	//console.log(JSON.parse(JSON.stringify(fileTree)));

	// List All menu buttons in side bar
	listMenuButtons(directory , files, sideMenu, doFoldDirectory);

	// Add watcher for root directory
	watcher.push(
		watch(rootDirectory, (evt, name) => {
			watchFileChange(rootDirectory, evt, name);
		})
	); 
}

function watchFileChange(directory, evt, name) {
	// If changed file is gdml then reload the whole project
	if (evt == 'update') {
		console.log("Detected file change of : " + name);
		let extName = path.extname(name).toLowerCase();
		if (extName === ".gdml" || extName === "") {
			// If setting directory is not the first time
			if (prevFileTree !== null) {
				// Result is either null or node.
				// Null means given name(path) doesn't match given root directory.
				console.log("Currently trying to check if file is in FileTree");
				console.log("Changed file name is :");
				console.log(JSON.parse(JSON.stringify(name)));
				console.log("Previous FileTree content");
				console.log(JSON.parse(JSON.stringify(prevFileTree)));
				let result = prevFileTree.getNode(name);
				if (result === undefined) {
					alert("Failed to resolve file hierarchy. Please reload directory.");
					return;
				}

				// if node already exists dont read root directory
				if (result !== null) {
					// TODO ::: Check if content has changed.
					return;
				} 
			}

			console.log("Setting root directory");
			// if file or directory has changed then reload root directory.
			setRootDirectory(rootDirectory);
		}
	} 
}

// SOURCE ::: https://stackoverflow.com/questions/12997123/print-specific-part-of-webpage/#answer-12997207
// FUNCTION ::: Print editor content into file
document.querySelector("#printBtn").addEventListener('click', () => {
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
function listMenuButtons(root, files, parentElement, foldDirectory = false) {
	// TODO ::: This should be handled as a proper config settings.
	// Do not show hidden files (files which names start with dot.)
	//files = files.filter(item => !(/(^|\/)\.[^/.]/g).test(item)); // copy pasted code
	
	// Directory is shown first and files are shown later.
	let dirsArray = files.filter(file => fs.lstatSync(path.join(root, file)).isDirectory());
	let filesArray = files.filter(file => !fs.lstatSync(path.join(root, file)).isDirectory());

	// Make Directory button with given directory list
	// If directory is in exclusion list then ignore.
	dirsArray.forEach((file) => {
		if (config.getExclusionRules().find(rule => path.join(rootDirectory, rule) === path.join(root, file)) !== undefined) {
			console.log("Found exclusion rule ignoring file : " + file);
			return;
		}

		listDirectory(root, path.basename(file), parentElement, foldDirectory);
	})

	// Make file button with given files list
	// If file is in exclusion list then ignore.
	filesArray.forEach((file) => {
		if (config.getExclusionRules().find(rule => path.join(rootDirectory, rule) === path.join(root, file)) !== undefined) {
			console.log("Found exclusion rule ignoring file : " + file);
			return;
		}

		if (path.extname(file).toLowerCase() === ".gdml") {
			listFile(root, path.basename(file), parentElement);
		} 
	})
}

// FUNCTION ::: Create File menu button
// TODO ::: Create divElem wrapper and set elem as a child
// Append a indicator div under divElem
function listFile(root, fileName, parentElement) {
	let fullPath = path.join(root , fileName);
	let fileYaml = yaml.load(fs.readFileSync(fullPath), 'utf8'); // this should not fail becuase it was read from readdirSync
	
	// check File validation
	// If not valid gdml file then return.
	if (!checker.IsValidGdmlString(fileYaml)) {
		return;
	}

	var divElem = document.createElement('div');
	var elem = document.createElement('button');
	var indElem = document.createElement('i'); // indicator for statuses

	let menuColor = UNDEFINEDCOLOR; // Undefined color
	if (fileYaml["status"] == OUTDATED) menuColor = OUTDATEDCOLOR;
	else menuColor = UPTODATECOLOR;

	elem.textContent = fileName;
	elem.dataset.path = fullPath;
	elem.dataset.index = -1;
	elem.addEventListener('click', loadGdmlToEditor);

	elem.addEventListener("dragstart", (event) => {
		// store a ref. on the dragged elem
		// didn't use dataTransfer because 
		event.dataTransfer.setData('text/plain', event.currentTarget.dataset.path);
	});

	elem.classList.add("font-bold", "text-left", "py-2", "px-4", "text-white", menuColor, "fileButton", "mb-1");
	elem.draggable = true;
	parentElement.appendChild(elem);
	// Add value to array(list) so that dependency checker can do his job.
	totalGdmlList.push({ path: fullPath, status: fileYaml["status"]});

	fileTree.initNode(fullPath, elem);
}


// TODO :: Merge this into listDirectory
function listDirectory(root, dirName, parentElement, foldDirectory = false) {
	var divElem = document.createElement('div');
	var dirElem = document.createElement('button');
	divElem.classList.add("border-gray-700", "border-t", "border-b", "flex", "flex-col");
	dirElem.classList.add("dirButton","font-bold", "text-left", "py-2", "px-4", "text-white", UNDEFINEDCOLOR, "mb-1");
	let fullPath = path.join(root, dirName);
	dirElem.textContent = "↓" + dirName;
	dirElem.dataset.path = fullPath;
	dirElem.addEventListener('click', toggleChildren);
	parentElement.appendChild(divElem);
	divElem.appendChild(dirElem);

	fileTree.initNode(fullPath, divElem);

	console.log("Listing directory of : " + fullPath);

	watcher.push(
		watch(fullPath, (evt, name) => {
			watchFileChange(fullPath, evt, name);
		})
	); 

	fs.readdir(fullPath, (err, files) => {
		if(err) {
			console.log("Failed to read recursive files in directory");
		} else {
			console.log("Listing files in directory");
			listMenuButtons(fullPath, files, divElem);

			if (prevFileTree !== null) {
				let targetNode = prevFileTree.getNode(fullPath);
				console.log(JSON.parse(JSON.stringify(fileTree)));
				console.log(targetNode);
				// If targetNode is undefined then no such directory exists now.
				if (foldDirectory || (targetNode !== null && targetNode.isFolded) ) {
					// Set isFolded to false becuase dirElem.click() calls toggleChildren
					// And toggleChildren toggle isFolded;
					targetNode.isFolded = false;
					dirElem.click();
				}
			} 
			// If it is a firs time reaeding rootDirectory, 
			// then fold all of directory buttons.
			else { // prevFileTree == null
				dirElem.click();
			}
		}
	});
}

// FUNCTION ::: Simply load gdml from filePath and return as string
function loadGdml(filePath) {
	// If given file is not gdml then return
	if (path.extname(filePath).toLowerCase() !== ".gdml") return null;
	try {
		let result = fs.readFileSync(filePath);
		return yaml.load(result, 'utf8');
	} catch {
		console.log("No file found");
		return null;
	}
}

// FUNCTION ::: Load Gdml file contents from file and paste into the 
// newly instantiated toastui editor if not existent.
// This function is called when sideMenu button or tab button is clicked.
function loadGdmlToEditor(event) {

	// If tab is already open then copy tab data into editorInstance.
	let tabIndex = Number(event.currentTarget.dataset.index);
	// If tabIndex is -1 it might be because listmenu button is clicked
	// In which case list menu doesn't have index value
	if (tabIndex === -1) 
		tabIndex = isTabPresent(event.currentTarget.dataset.path);

	// If file is already open thus tab exists
	if(tabIndex !== -1){
		// Hide CurrentTab
		hideCurrentTab();

		// Change currentTabIndex
		let indexCache = currentTabIndex;
		currentTabIndex = tabIndex;
		// And show selected tab
		tabObjects[currentTabIndex].screen.style.display = "";
		tabObjects[currentTabIndex].meta.style.display = "";
		tabObjects[currentTabIndex].tab.parentElement.classList.add(HIGHLIGHT);
		tabObjects[currentTabIndex].tab.parentElement.classList.remove(NORMALBG);
		// Update Status Bar
		statusGraphics(tabObjects[currentTabIndex].content["status"]);

		if (tabObjects[indexCache].temp) {
			closeTab(tabObjects[indexCache].path);
		}

		return;
	}

	// At least one tab is opened and user is trying to open another tab with another file
	// Hide currently visible tab or delte if tab is temporary.
	if(currentTabIndex !== -1) {
		if (tabObjects[currentTabIndex].temp) {
			closeTab(tabObjects[currentTabIndex].path);
		} else {
			hideCurrentTab();
		}
	} // else if tab is not opened at all don't have to hide anything.


	// Declaring filePath
	let filePath = event.currentTarget.dataset.path;
	// If no tab is open, then read file and paste data into newly created editor. 
	fs.readFile(filePath, 'utf8', (err, data) => {
		if (err) {
			alert("Failed to read file");
			return;
		}
		let metaElem = metaBar.cloneNode(true);
		let editorScreenElem = editorScreen.cloneNode(true);
		mainDiv.appendChild(metaElem);
		mainDiv.appendChild(editorScreenElem);
		metaElem.style.display = "";
		editorScreenElem.style.display = "";

		// Make currentTabIndex to be same as length minus 1 which is 
		// last index of newly edited array.
		// CurrentTab Index should be equal to length because in this line length is not added by 1.
		currentTabIndex = tabObjects.length;
		let editorInstance = initEditor("Editor_" + currentTabIndex, editorScreenElem);

		var tabObject = newTabObject(true, SAVED, SAVED, false, filePath, new Set() , yaml.safeLoad(data, 'utf8'), metaElem, editorScreenElem, null, editorInstance);

		// LEGACY ::: tabObject before newTabObject method should be here for reference
		//var tabObject = {contentStatus: SAVED, refStatus: SAVED, manualSave: false, path: filePath, ref: new Set() ,content: yaml.safeLoad(data, 'utf8'), meta: metaElem, screen: editorScreenElem, tab: null, editor: editorInstance};
		
		tabObjects.push(tabObject);
		editorInstance.setMarkdown(tabObject.content["body"], false);
		editorInstance.changeMode(config.content["startMode"]);

		// If editor's content changes and content is different from original one
		// then set status to unsaved.
		// Also change tab's name to somewhat distinguishable.
		editorInstance.on("change", () => {
			let currentTab = tabObjects[currentTabIndex];
			if (currentTab.content["body"] !== currentTab.editor.getMarkdown().trim()) {
				currentTab.contentStatus = UNSAVED;
				currentTab.tab.textContent = path.basename(currentTab.path) + UNSAVEDSYMBOL;
				if (currentTab.temp) currentTab.temp = false;
			} else { // both contents are same
				currentTab.contentStatus = SAVED;
				if (currentTab.refStatus === SAVED) {
					currentTab.tab.textContent = path.basename(currentTab.path);
				}
			}

		});

		// Add new Tab 
		let newTab = addNewTab(filePath);
		tabObject.tab = newTab;

		// Set highlight color
		tabObjects[currentTabIndex].tab.parentElement.classList.add(HIGHLIGHT);
		tabObjects[currentTabIndex].tab.parentElement.classList.remove(NORMALBG);

		// set status graphic
		statusGraphics(tabObjects[currentTabIndex].content["status"]);
		// TODO ::: COMPLETE THIS
		listReferences();
		
		//let refDiv = metaElem.querySelector("#references");
		// Add drag drop event to references
		metaElem.addEventListener('dragover', (event) => {
			event.preventDefault();
		});
		metaElem.addEventListener('drop', (event) => {
			addRefBtn(event.dataTransfer.getData("text"), false);
		});
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
	btnElem.dataset.index = tabObjects.length - 1;
	btnElem.textContent = path.basename(filePath);
	btnElem.addEventListener('click', loadGdmlToEditor);

	// TODO :: Make close button
	let closeButton = document.createElement('button');
	let iconElement = document.createElement('i');
	iconElement.classList.add("fas", "fa-times", "pl-1");
	closeButton.addEventListener('click', (event) => {
		// Get parent target and close
		// Also stop propagation so that clicking parent button should not be triggered.
		closeTab(event.currentTarget.previousSibling.dataset.path);
		event.stopPropagation();
	});

	closeButton.append(iconElement);
	divElem.appendChild(btnElem);
	divElem.appendChild(closeButton);
	tabMenu.appendChild(divElem);

	return btnElem;
}

// TODO ::: Warn if unsaved content exists.
// FUNCTION ::: Function attached Close tab button (X button)
// Deletion is determined with path not index.
function closeTab(path) {
	let targetTabObject = tabObjects.find(object => object.tab.dataset.path === path);
	let index = tabObjects.indexOf(targetTabObject);

	if (targetTabObject.refStatus !== SAVED || targetTabObject.contentStatus !== SAVED) {
		if (!confirm("Unsaved content exists. Do exit?")) return;
	}

	targetTabObject.tab.parentElement.remove();
	targetTabObject.screen.remove();
	targetTabObject.meta.remove();

	// Delete tabObject from array
	tabObjects.splice(index, 1);

	// if other tabs are exsiting
	// if tabObjectslength === 0 then, currently no object is present as data or element.
	// if not then there is either data or element.
	if (tabObjects.length !== 0) { 
		// if Index is bigger than currentTabIndex; Do nothing 
		//
		// if Index is same with currentTabIndex;
		if (index == currentTabIndex) {
			// if index is bigger than 0 decrease by 1
			// else if index === 0 then, don't need to change index.
			// Other remaining element should be in 0 index
			if (index > 0) {
				currentTabIndex -= 1;
			}
			
			// Show remaining tab
			tabObjects[currentTabIndex].screen.style.display = "";
			tabObjects[currentTabIndex].meta.style.display = "";
			tabObjects[currentTabIndex].tab.parentElement.classList.add(HIGHLIGHT);
			tabObjects[currentTabIndex].tab.parentElement.classList.remove(NORMALBG);

			statusGraphics(tabObjects[index].content["status"]);
		}
		// if Index is lower than currentTabIndex
		// Decrease by 1 because currentTabIndex is logically changed by deletion.
		if (index < currentTabIndex) {
			currentTabIndex -= 1;
		}

		// Decrease all tab's index by 1 which index data is bigger than 'index'
		// let i is index not index + 1 becuase 'index' is former target value to close
		// In here targetObject is already destroyed so index points to after object.
		for (let i = index; i < tabObjects.length; i++) {
			tabObjects[i].tab.dataset.index = Number(tabObjects[i].tab.dataset.index) - 1;
		}
	} 
	//if tabObjects' length i 0 then rest currentTabIndex (which is setting to -1)
	else {
		currentTabIndex = -1;
	}
}


// FUNCTION ::: Toggle children elements of directory menu button
function toggleChildren(event) {
	let children = event.currentTarget.parentElement.querySelectorAll(".fileButton");
	//let dirChidlren = event.currentTarget.parentElement.querySelectorAll(".dirButton:not(.first)");
	// Toggle is Folded
	fileTree.getNode(event.currentTarget.dataset.path).isFolded = !fileTree.getNode(event.currentTarget.dataset.path).isFolded;
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
	//dirChidlren.forEach(child => {
		//// If not folded then fold
		//if (child.style.display === "none") {
			//child.style.display = "block";
		//} 
		//// if folded then unfold
		//else {
			//child.style.display = "none";
		//}
	//})
}

// FUNCTION ::: Initiate ToastEditorInstance with given new Id.
// if duplicate id exists then editor would not work properly.
function initEditor(newId, element, mode="wysiwyg") {
	element.id = newId;
	var editor = new Editor({
		el: element,
		previewStyle: 'tab',
		height: '100%',
		initialEditType: mode,
		language: 'ko'
	});
	editor.getHtml();

	return editor;
}

// FUNCTION ::: Apply Status graphical effect
function statusGraphics(statusString) {
	let statusDiv = tabObjects[currentTabIndex].meta.querySelector("#statusBar");
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
// FUNCTION ::: List references button to status bar
function listReferences() {
	// get list of referecnes from the tabObject 
	let references = tabObjects[currentTabIndex].content["reference"]; // This is array
	tabObjects[currentTabIndex].refs = new Set(references); // TODO ::: THis might be buggy

	references.forEach((ref) => {
		addRefBtn(ref, true);
	});
}

// FUNCTION ::: Add reference button, called from listReferences function.
function addRefBtn(fileName, listing) {
	let currentTabObject = tabObjects[currentTabIndex];

	// If listing is not true then it is adding what is not read from file
	if (!listing) {
		// if reference already exists then ignore.
		if (currentTabObject.refs.has(fileName)) return;
		// make unsaved
		currentTabObject.refStatus = UNSAVED;
		currentTabObject.tab.textContent = path.basename(currentTabObject.path) + UNSAVEDSYMBOL;
		currentTabObject.refs.add(fileName);
	}

	let divElem = document.createElement('div');
	var elem = document.createElement('button');
	let filePath = fileName;

	let fileYaml = yaml.load(fs.readFileSync(filePath)); // this should not fail becuase it was read from readdirSync
	let menuColor = UNDEFINEDCOLOR; // Undefined color
	if (fileYaml["status"] == OUTDATED) menuColor = OUTDATEDCOLOR;
	else menuColor = UPTODATECOLOR;
	divElem.classList.add("blankButton", menuColor);

	elem.textContent = path.basename(filePath);
	elem.dataset.path = filePath;
	elem.addEventListener('click', loadGdmlToEditor);
	elem.classList.add("font-semibold");

	// TODO :: Make close button
	let closeButton = document.createElement('button');
	let iconElement = document.createElement('i');
	iconElement.classList.add("fas", "fa-times", "pl-1");
	closeButton.addEventListener('click', (event) => {
		// Get parent target and close
		// Also stop propagation so that clicking parent button should not be triggered.
		// Remove reference from currentTabObject's references
		// if removed version is equal to read value then set to SAVED
		let currentTabObject =tabObjects[currentTabIndex];
		let refValue = event.currentTarget.previousSibling.dataset.path;
		currentTabObject.refs.delete(refValue);
		if (_.isEqual(new Set(currentTabObject.content["reference"]), currentTabObject.refs)) {
			currentTabObject.refStatus = SAVED;
			if (currentTabObject.contentStatus === SAVED) {
				currentTabObject.tab.textContent = path.basename(currentTabObject.path);
			}
		} else {
			currentTabObject.refStatus = UNSAVED;
			currentTabObject.tab.textContent = path.basename(currentTabObject.path) + UNSAVEDSYMBOL;
		}
		event.currentTarget.parentElement.remove();
		event.stopPropagation();
	});

	closeButton.append(iconElement);
	divElem.appendChild(elem);
	divElem.appendChild(closeButton);
	currentTabObject.meta.querySelector("#references").appendChild(divElem);
}

function newTabObject(temp, contentStatus, refStatus, manualSave, path, refs, content, meta, screen, tab, editor) {
	return {
		temp: temp,
		contentStatus: contentStatus, 
		refStatus: refStatus, 
		manualSave: manualSave, 
		path: path, 
		refs: refs,
		content: content, 
		meta: meta, 
		screen: screen, 
		tab: tab, 
		editor: editor
	};
}

// TODO ::: Make this work
// FUNCTION ::: Hide Current tab, which is called when another tab is clicked.
function hideCurrentTab() {
	// Hide screen and toggle color of tab Object
	tabObjects[currentTabIndex].screen.style.display = "none";
	tabObjects[currentTabIndex].meta.style.display = "none";
	tabObjects[currentTabIndex].tab.parentElement.classList.remove(HIGHLIGHT);
	tabObjects[currentTabIndex].tab.parentElement.classList.add(NORMALBG);
}

// FUNCTION ::: Toggle between editing different modes ( wysiwyg and markdown mode ).
function toggleMode() {
	// if no tab is open then ignore(return).
	if (currentTabIndex === -1) return;

	let currentTabObject = tabObjects[currentTabIndex];

	if (currentTabObject.editor.isMarkdownMode()) {
		currentTabObject.editor.changeMode('wysiwyg');
	} else {
		currentTabObject.editor.changeMode('markdown');
	}
}


// REFERENCE :::  Font sizes of toast ui editor
// default font size is 13px
// h1 : 24px / division : 1.846153846 => 1.846rem
// h2 : 22px / division : 1.692307692 => 1.692rem
// h3 : 20px / division : 1.538461538 => 1.538rem
// h4 : 18px / division : 1.384615385 => 1.385rem
// h5 : 16px / division : 1.230769231 => 1.231rem
// h6 : 14px / division : 1.076923077 => 1.077rem

// FUNCTION ::: Change Font size of editor.
// This function is especially limited to Toast Ui Editor 
function setFontSize() {
	let multiplier = 1.0;
	if (config.content["fontSize"] === "small") {
		multiplier = 1.0;
	} else if (config.content["fontSize"] === "middle") {
		multiplier = 1.1;
	} else if (config.content["fontSize"] === "large") {
		multiplier = 1.2;
	}
	// No indent for better eading
	document.querySelector('style').innerHTML = 
`.CodeMirror-lines, .tui-editor-contents {
	font-size : ${ multiplier }rem !important;
}
.tui-md-heading {
	font-size : ${ 1.846 * multiplier}rem !important;
}
.tui-md-heading2 {
	font-size : ${ 1.692 * multiplier}rem !important;
}
.tui-md-heading3 {
	font-size : ${ 1.538 * multiplier}rem !important;
}
.tui-md-heading4 {
	font-size : ${ 1.385 * multiplier}rem !important;
}
.tui-md-heading5 {
	font-size : ${ 1.231 * multiplier}rem !important;
}
.tui-md-heading6 {
	font-size : ${ 1.077 * multiplier}rem !important;
}`;
}
