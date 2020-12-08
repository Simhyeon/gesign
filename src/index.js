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
const config = require("./config");
const shared = require("./shared");
const {FileTree} = require("./filetree");
const template = require('./template')
const CliOption = cli.CliOption;
const {ConfigWindow} = require('./configwindow');

// VARIABLE ::: variable reserved for dragging
let dragged = null;

/// VARIABLE ::: Declare class instance to use 
let watcher = new Array();
// This File tree variable is for checking 
// if directory should be foled after reloading
let prevFileTree = null;
let fileTree = null;

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
const NEWFILENAME = "new*.gdml";

// VARAIBLE ::: CSS class values are all based on tailwind-css class names
const UNDEFINEDCOLOR = "bg-gray-600";
const TEMPORARY = new Array("border-dashed");
const HIGHLIGHT = new Array("border-b-2", "hover:opacity-80"); 
const NORMALBG = new Array("opacity-50", "hover:opacity-100");
const OUTDATEDCOLOR = "bg-red-500";
const UPTODATECOLOR = "bg-blue-500";
const OUTDATEDTEXTCOLOR = "outdatedRed";
const UPTODATETEXTCOLOR = "uptodateBlue";

// VARAIBLE ::: Caching of specific dom elements.
const tabMenu = document.querySelector("#openedTabs");
const sideMenu = document.querySelector('#menuContents');
const mainDiv = document.querySelector("#main");
const metaBar = document.querySelector("#metaBar");
const editorScreen = document.querySelector("#editorScreen");

// ----------------------------------------------------------------------------
// INITIATION ::: Execute multiple initiation operation. 
// Editorscreen should not be displayed but cloned and then set visible.
// while metabar is ubiquotus
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

// Given directory from current working directory.
// This gets overridedn when user gives specific directory with --dir flag
let givenDirectory = remote.process.cwd();
// ----------------------------------------------------------------------------

// VARAIBLE ::: Cli option related variables and initialization
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

	if (shared.rootDirectory == null) return;

	let tabCache = -1;
	if(currentTabIndex !== -1) {
		// HIde when tab is either temporary
		if (tabObjects[currentTabIndex].temp ) {
			// Or tab is loaded from refernce button
			// If the latter than set instance as non temporary.
			tabCache = currentTabIndex;
		} else {
			hideCurrentTab();
		}
	} // else if tab is not opened at all don't have to hide anything.

	let metaElem = metaBar.cloneNode(true);
	let editorScreenElem = editorScreen.cloneNode(true);
	mainDiv.appendChild(metaElem);
	mainDiv.appendChild(editorScreenElem);
	metaElem.style.display = "";
	editorScreenElem.style.display = "";

	editorScreenElem.addEventListener('drop', dropToPasteFile);

	currentTabIndex = tabObjects.length;
	let editorInstance = initEditor("Editor_" + currentTabIndex, editorScreenElem, config.content["startMode"]);

	var tabObject = newTabObject(false, SAVED, SAVED, true, path.join(shared.rootDirectory, NEWFILENAME), new Set(), gdml.newGdml(), metaElem, editorScreenElem, null, editorInstance);

	// IMPORTANT ::: push should be done before other tab related  
	// becuase other operations assume that length of tabObjects has changed already.
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
	tabObjects[currentTabIndex].tab.parentElement.classList.add(...HIGHLIGHT);
	tabObjects[currentTabIndex].tab.parentElement.classList.remove(...NORMALBG);

	// set status graphic
	statusGraphics(tabObjects[currentTabIndex].content["status"]);
	// Add drag drop event to references
	metaElem.addEventListener('dragover', (event) => {
		event.preventDefault();
	});
	metaElem.addEventListener('drop', (event) => {
		addRefBtn(event.dataTransfer.getData("text"), false);
	});

	// If tabcache has been saved
	if (tabCache !== -1) {
		closeTab(tabObjects[tabCache].path);
		//console.log(JSON.parse(JSON.stringify(tabObjects.length)));
	}
});

// EVENT ::: Make Checker object and add all gdml documents as NodeInstance to checkerinstance
document.querySelector("#checker").addEventListener('click', () => {
	checkerButton();
});

// FUNCTION ::: Called by checkerButton event
function checkerButton() {
	if (shared.rootDirectory === null) return;

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
			checker.addNode(totalGdmlList[i].path, gdml, shared.rootDirectory);
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

	//console.log(totalGdmlList.length === checkerList.length);

	// TODO ::: Should change statuses of menu buttons 
	// In first sight it should be ok becuase fs filewatch will detect status change and will
	// read from root Directory.
	// Should change statues of opened tabs
	for (let j = 0, leng = totalGdmlList.length; j < leng; j++) {
		// If Status has changed after dependency check, apply changes to file
		// With this approcah caching(memory usage) is minified and I/O is maximized.
		if (totalGdmlList[j].status !== checkerList[j].status) {
			//console.log("UPdating : " + totalGdmlList[j].path);
			let readFile = yaml.load(fs.readFileSync(totalGdmlList[j].path), 'utf8');
			readFile["status"] = checkerList[j].status;
			fs.writeFileSync(totalGdmlList[j].path, yaml.safeDump(readFile), 'utf8');
			shared.shouldReload = true;

			if (currentTabIndex !== -1 && 
				totalGdmlList[j].path === tabObjects[currentTabIndex].path) {
				//console.log("Should update current statusGraphic");
				statusGraphics(checkerList[j].status);
			}
		}
	}
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
	//console.log(currentTabObject);
	if(currentTabObject.contentStatus !== UNSAVED && currentTabObject.refStatus !== UNSAVED) return; // if file is not unsaved then skip operation

	// Update content body with editor's content
	//
	// Update lastModified(timeStamp) only content has changed.
	// If not changing reference will cause timestamp and will be set to uptodate
	// automatically.
	if (currentTabObject.contentStatus == UNSAVED) {
		currentTabObject.content["lastModified"] = Date.now();
	}
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

// EVENT ::: Open Dialog and set shared.rootDirectory
document.querySelector("#openDirBtn").addEventListener('click', () => {
	let newDirectory = shared.rootDirectory;
	if (shared.rootDirectory === null) newDirectory = givenDirectory
	remote.dialog.showOpenDialog(remote.getCurrentWindow(),{defaultPath: newDirectory, properties: ["openDirectory"]}).then((response) => {
		if(!response.canceled) {
			// Reset gdml List
			setRootDirectory(response.filePaths[0]);
		}
	});
});

// FUNCTION ::: Check if tab content is identical to
// disk file's content. If not copy paste into it.
// If editor content is unsaved, then create new document.
function checkTabContents() {
	tabObjects.forEach(item => {
		if (item.path === NEWFILENAME) return;
		fs.readFile(item.path, (err, data) => {
			if (err) {
				console.error("Failed to read file from tab" + err);
			} else {
				// Load file contents
				let readContent = yaml.load(data, 'utf8');
				// Compare contents of read file and editor's contents
				if (readContent !== item.content) {
					// If editor is unsaved
					// Set to manualSave so that user can save to another file
					if (item.contentStatus === UNSAVED || item.refStatus === UNSAVED) {
						item.manualSave = true;
						item.tab.textContent = path.basename(item.path) + UNSAVEDSYMBOL;
					} 
					// If editor content is not "unsaved"
					// just copy file contents to editor
					else {
						// TODO ::: THIS might be bloat, however this app is bloat anyway.
						// Reason why checking equality before setting, although it looks redundant
						// is that pasting makes cursor to move to start area which is not an ideal
						// experience for end users.
						if (item.editor.getMarkdown().trim() !== readContent["body"].trim()) {
							item.content = readContent;
							item.editor.setMarkdown(readContent["body"], false);
						}

						// Get References from list
						readContent["reference"].forEach((ref) => {
							if (!item.refs.has(ref)) {
								addRefBtn(ref, true);
							}
						});

						item.refs = new Set(readContent["reference"]);
					}

					if (item.index === currentTabIndex) statusGraphics(readContent["status"]);
				}

			}
		});
	});
}

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
		config.init(path.join(directory, "gesign_config.json"));
		// DEUBG ::: config.readFromFile(path.join(directory, "gesign_config.json"));
		// Change font size according to font size
		setFontSize();

		// Remove children of sideMenu
		while(sideMenu.firstChild) {
			sideMenu.removeChild(sideMenu.firstChild);
		}

		// Make root directory buttonish div
		var divElem = document.createElement('div');
		var dirElem = document.createElement('div');
		divElem.classList.add("flex", "flex-col");
		dirElem.classList.add("font-bold", "text-left", "py-2", "px-4", "text-white", UNDEFINEDCOLOR, "my-1", "w-full", 'select-none');
		dirElem.textContent = "<" + path.basename(directory) + ">";
		sideMenu.appendChild(divElem);
		divElem.appendChild(dirElem);


		// Set variable that decided whether fold or not.
		doFoldDirectory = (shared.rootDirectory === null || shared.rootDirectory !== directory);

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
	if (shared.rootDirectory !== directory && shared.rootDirectory !== null) {

		// Reset tabObjects
		tabObjects.forEach((tabObject) => {
			tabObject.tab.remove();
			tabObject.meta.remove();
			tabObject.screen.remove();
		});
		tabObjects = new Array();
		currentTabIndex = -1;
	} 
	// If reopening same shared.rootDirectory then check if tabObjects are still valid
	else {
		tabObjects.forEach((tabObject) => {
			// If tab's content is not saved to a file yet, ignore.
			if (tabObject.path === NEWFILENAME ) return;
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
					// If editor content is saved or not "unsaved"
					// just copy file contents to editor
					else {
						tabObject.content = readContent;
						// TODO ::: THIS might be bloat, however this app is bloat anyway.
						// Reason why checking equality before setting, although it looks redundant
						// is that pasting makes cursor to move to start area which is not an ideal
						// experience for end users.
						if (tabObject.editor.getMarkdown().trim() !== readContent["body"].trim()) {
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

					if (tabObject.index === currentTabIndex) statusGraphics(readContent["status"]);
				}
			}
		})
	}

	// Update root directory
	shared.rootDirectory = directory;	

	// DEBUG ::: 
	// Cache fileTree becuase retaining fold status
	// Requires previous fold status from previous FileTree
	// Such process can be optimized by ignoring folding check when root directory has changed.
	prevFileTree = fileTree;
	fileTree = new FileTree(shared.rootDirectory);
	//console.log(prevFileTree);
	//console.log(fileTree);
	//console.log(JSON.parse(JSON.stringify(prevFileTree)));
	//console.log(JSON.parse(JSON.stringify(fileTree)));

	// List All menu buttons in side bar
	listMenuButtons(directory , files, sideMenu, doFoldDirectory);

	// Add watcher for root directory
	watcher.push(
		watch(shared.rootDirectory, (evt, name) => {
			watchFileChange(shared.rootDirectory, evt, name);
		})
	); 
}

// FUNCTION ::: Watch file changes within given directory.
// directory parameter is not used but indicates that which directory is
// being watched obvious to programmer.
function watchFileChange(directory, evt, name) {
	// If changed file is gdml then reload the whole project
	if (evt == 'update') {
		console.log("Detected file change of : " + name);
		if (name === path.join(shared.rootDirectory, config.CONFIGFILENAME)) {
			config.init(name);
			setRootDirectory(shared.rootDirectory);
		}
		let extName = path.extname(name).toLowerCase();
		if (extName === ".gdml" || extName === "") {
			// If setting directory is not the first time
			if (prevFileTree !== null) {
				// Result is either null or node.
				// Null means given name(path) doesn't match given root directory.
				//console.log("Currently trying to check if file is in FileTree");
				//console.log("Changed file name is :");
				//console.log(JSON.parse(JSON.stringify(name)));
				//console.log("Previous FileTree content");
				//console.log(JSON.parse(JSON.stringify(prevFileTree)));
				let result = prevFileTree.getNode(name);
				if (result === undefined) {
					alert("Failed to resolve file hierarchy. Please reload directory.");
					return;
				}

				// if node already exists dont read root directory
				// but copy paste changed content into tabs.
				if (result !== null && !shared.shouldReload) {
					checkTabContents();
					return;
				} 
			}

			// Reset variable.
			if (shared.shouldReload) shared.shouldReload = false;
			// if file or directory has changed then reload root directory.
			setRootDirectory(shared.rootDirectory);
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

// EVENT ::: Open config window
document.querySelector("#configWindow").addEventListener('click', () => {
	if (shared.rootDirectory == null || shared.noconfig) return;
	let configWindow = new ConfigWindow();
})

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
		if (config.exclusionRules().find(rule => path.join(shared.rootDirectory, rule) === path.join(root, file)) !== undefined) {
			console.log("Found exclusion rule ignoring file : " + file);
			return;
		}

		listDirectory(root, path.basename(file), parentElement, foldDirectory);
	})

	// Make file button with given files list
	// If file is in exclusion list then ignore.
	filesArray.forEach((file) => {
		if (config.exclusionRules().find(rule => path.join(shared.rootDirectory, rule) === path.join(root, file)) !== undefined) {
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
	if (!gdml.IsValidGdmlString(fileYaml)) {
		return;
	}

	var divElem = document.createElement('div');
	var elem = document.createElement('button');
	var indElem = document.createElement('i'); // indicator for statuses

	//let menuColor = UNDEFINEDCOLOR; // Undefined color
	//if (fileYaml["status"] == OUTDATED) menuColor = OUTDATEDCOLOR;
	//else menuColor = UPTODATECOLOR;
	
	let buttonStatus = "uptodate"; // Undefined color
	if (fileYaml["status"] == OUTDATED) buttonStatus = "outdated";

	// If filename is too long then cut it
	fileName = path.basename(fileName, '.gdml')

	if (fileName.length > 15) {
		fileName = fileName.slice(0, 15) + "...";
	}

	elem.textContent = fileName;
	elem.dataset.path = fullPath;
	elem.dataset.index = -1;
	elem.addEventListener('click', loadGdmlToEditor);

	elem.addEventListener("dragstart", (event) => {
		// store a ref. on the dragged elem
		// didn't use dataTransfer because 
		event.dataTransfer.setData('text/plain', event.currentTarget.dataset.path);
	});

	//elem.classList.add("font-bold", "text-left", "py-2", "px-4", "text-white", menuColor, "fileButton", "mb-1", "w-full");
	divElem.classList.add("flex", "items-center");
	elem.classList.add("font-bold", "text-left", "py-2", "pl-4", "text-gray-200", "fileButton", "mb-1", "w-full", "inline", "hover:opacity-50", buttonStatus);
	indElem.classList.add("fas", "fa-exclamation-triangle", "text-gray-300", "mr-2");

	elem.draggable = true;
	parentElement.appendChild(divElem);
	// Add value to array(list) so that dependency checker can do his job.
	totalGdmlList.push({ path: fullPath, status: fileYaml["status"]});

	divElem.appendChild(elem);
	divElem.appendChild(indElem);

	fileTree.initNode(fullPath, elem);
}

// FUNCTION ::: Create directory menu button
function listDirectory(root, dirName, parentElement, foldDirectory = false) {
	var divElem = document.createElement('div');
	var dirElem = document.createElement('button');
	divElem.classList.add("directory", "flex", "flex-col");
	dirElem.classList.add("dirButton","font-bold", "text-left", "py-2", "px-4", "text-gray-200", UNDEFINEDCOLOR, "mb-1", "w-full", "hover:opacity-50");
	let fullPath = path.join(root, dirName);
	dirElem.textContent = "> " + dirName;
	dirElem.dataset.path = fullPath;
	dirElem.addEventListener('click', toggleChildren);
	parentElement.appendChild(divElem);
	divElem.appendChild(dirElem);

	fileTree.initNode(fullPath, divElem);

	//console.log("Listing directory of : " + fullPath);

	// Add watcher element with directory
	watcher.push(
		watch(fullPath, (evt, name) => {
			watchFileChange(fullPath, evt, name);
		})
	); 

	fs.readdir(fullPath, (err, files) => {
		if(err) {
			console.log("Failed to read recursive files in directory");
		} else {
			//console.log("Listing files in directory");
			listMenuButtons(fullPath, files, divElem);

			if (prevFileTree !== null) {
				// If targetNode was already in previous file tree ... 
				let targetNode = prevFileTree.getNode(fullPath);
				//console.log(JSON.parse(JSON.stringify(fileTree)));
				//console.log(targetNode);
				// If targetNode is undefined then no such directory exists now.
				// if targetNode was folded previously set to folded again.
				if (foldDirectory || (targetNode !== null && targetNode.isFolded) ) {
					// Set isFolded to false becuase dirElem.click() calls toggleChildren
					// And toggleChildren toggle isFolded;
					targetNode.isFolded = false;
					dirElem.click();
				}
			} 
			// If it is a firs time reaeding shared.rootDirectory, 
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

	// Get event's tab Index
	let tabIndex = Number(event.currentTarget.dataset.index);
	// If tabIndex is -1 it might be because listmenu button is clicked
	// In which case list menu doesn't have index value
	if (tabIndex === -1) 
		tabIndex = isTabPresent(event.currentTarget.dataset.path);

	//console.log(tabIndex);
	// If file is already open thus tab exists
	if(tabIndex !== -1 && !isNaN(tabIndex)){
		// Hide CurrentTab
		hideCurrentTab();

		// Change currentTabIndex
		let indexCache = currentTabIndex;
		currentTabIndex = tabIndex;
		// And show selected tab
		tabObjects[currentTabIndex].screen.style.display = "";
		tabObjects[currentTabIndex].meta.style.display = "";
		tabObjects[currentTabIndex].tab.parentElement.classList.add(...HIGHLIGHT);
		tabObjects[currentTabIndex].tab.parentElement.classList.remove(...NORMALBG);
		// Update Status Bar
		console.log("Loading exsiting tab");
		console.log(tabObjects[currentTabIndex].content["status"]);
		statusGraphics(tabObjects[currentTabIndex].content["status"]);

		// If prior tab was temporary delete tab
		// If clicking button that is opened as temporary tab don't do anything
		if (tabObjects[indexCache].temp && indexCache !== currentTabIndex) {
			closeTab(tabObjects[indexCache].path);
		}

		return;
	}

	// At least one tab is opened and user is trying to open another tab with another file
	// Hide currently visible tab or delte if tab is temporary.
	let tabCache = -1;
	if(currentTabIndex !== -1) {
		// HIde when tab is either temporary
		if (tabObjects[currentTabIndex].temp ) {
			// Or tab is loaded from refernce button
			// If the latter than set instance as non temporary.
			if (event.currentTarget.classList.contains("refBtn")) {
				hideCurrentTab();
				tabObjects[currentTabIndex].temp = false;
				tabObjects[currentTabIndex].tab.parentElement.classList.remove(...TEMPORARY);
			} else {
				tabCache = currentTabIndex;
			}
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

		editorScreenElem.addEventListener('drop', dropToPasteFile);

		// Make currentTabIndex to be same as length minus 1 which is 
		// last index of newly edited array.
		// CurrentTab Index should be equal to length because in this line length is not added by 1.
		currentTabIndex = tabObjects.length;
		let editorInstance = initEditor("Editor_" + currentTabIndex, editorScreenElem);

		var tabObject = newTabObject(config.content.unpinAuto , SAVED, SAVED, false, filePath, new Set() , yaml.safeLoad(data, 'utf8'), metaElem, editorScreenElem, null, editorInstance);

		// LEGACY ::: tabObject before newTabObject method should be here for reference
		//var tabObject = {contentStatus: SAVED, refStatus: SAVED, manualSave: false, path: filePath, ref: new Set() ,content: yaml.safeLoad(data, 'utf8'), meta: metaElem, screen: editorScreenElem, tab: null, editor: editorInstance};
		
		tabObjects.push(tabObject);
		editorInstance.setMarkdown(tabObject.content["body"].trim(), false);
		editorInstance.changeMode(config.content["startMode"]);

		// ANONYMOUSE FUNCTION
		// If editor's content changes and content is different from original one
		// then set status to unsaved.
		// Also change tab's name to somewhat distinguishable.
		editorInstance.on("change", () => {
			let currentTab = tabObjects[currentTabIndex];
			if (currentTab.content["body"] !== currentTab.editor.getMarkdown().trim()) {
				currentTab.contentStatus = UNSAVED;
				currentTab.tab.textContent = path.basename(currentTab.path) + UNSAVEDSYMBOL;
				if (currentTab.temp) {
					currentTab.temp = false;
					currentTab.tab.parentElement.classList.remove(...TEMPORARY);
				}
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

		if (tabObject.temp) newTab.parentElement.classList.add(...TEMPORARY);

		// Set highlight color
		tabObjects[currentTabIndex].tab.parentElement.classList.add(...HIGHLIGHT);
		tabObjects[currentTabIndex].tab.parentElement.classList.remove(...NORMALBG);

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

		// If tabcache has been saved
		if (tabCache !== -1) {
			closeTab(tabObjects[tabCache].path);
			//console.log(JSON.parse(JSON.stringify(tabObjects.length)));
		}
	});
}

// FUNCTION ::: Pin tab and apply CSS classes.
function pinTab(event) {
	// Get event's tab Index
	let tabIndex = Number(event.currentTarget.dataset.index);

	tabObjects[tabIndex].temp = false;
	tabObjects[tabIndex].tab.parentElement.classList.remove(...TEMPORARY);
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

	//divElem.classList.add("blankButton", "bg-white");
	divElem.classList.add( "text-gray-200", "font-bold", "py-1", "px-2", UNDEFINEDCOLOR, "tabParent");
	// DEBUG ::: 
	divElem.draggable = true;
	divElem.addEventListener('dragover', (event) => {
		event.preventDefault();
	}, false);

	divElem.addEventListener('dragstart', (event) => {
		event.dataTransfer.setData('text/plain', null);
		dragged = event.currentTarget;
	}, false);

	divElem.addEventListener('drop', (event) => {
		if (!dragged.classList.contains("tabParent") || dragged === null) {
			dragged = null;
			return;
		}
		// TODO ::: Check where the mouse position is 
		// Change the order according to the mouse position.
		// Use dragged object to change order. use insertbefore either insertafter
		//
		let rect = event.currentTarget.getBoundingClientRect();
		let x = event.clientX - rect.left; //x position within the element.
		console.log(x);
		if (rect.width / 2 >= x) {
			console.log("Insert before");
			//insertbefore
			//
			// Get siblings of dragged and increase index by 1
			// remove dragged from parent and add before target.
			event.currentTarget.parentElement.insertBefore(dragged, event.currentTarget);
		} else if (rect.width / 2 < x) {
			console.log("Insert After");
			//insertafter
			//
			// Get siblings of dragged and increase index by 1
			// remove dragged from parent and add before target.
			event.currentTarget.parentElement.insertBefore(dragged, event.currentTarget.nextSibling);
		}

	}, false);

	btnElem.dataset.path = filePath;
	btnElem.dataset.index = tabObjects.length - 1;
	btnElem.textContent = path.basename(filePath);
	btnElem.addEventListener('click', loadGdmlToEditor);
	btnElem.addEventListener('dblclick', pinTab);
	btnElem.classList.add("tabBtn", "font-semibold");

	// TODO :: Make close button
	let closeButton = document.createElement('button');
	let iconElement = document.createElement('i');
	iconElement.classList.add("fas", "fa-times", "pl-1", "hover:opacity-50");
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
	let targetDataIndex = Number(targetTabObject.tab.dataset.index);
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
		if (index === currentTabIndex) {
			// if index is bigger than 0 decrease by 1
			// else if index === 0 then, don't need to change index.
			// Other remaining element should be in 0 index
			if (index > 0) {
				currentTabIndex -= 1;
			}
			
			// Show remaining tab
			tabObjects[currentTabIndex].screen.style.display = "";
			tabObjects[currentTabIndex].meta.style.display = "";
			tabObjects[currentTabIndex].tab.parentElement.classList.add(...HIGHLIGHT);
			tabObjects[currentTabIndex].tab.parentElement.classList.remove(...NORMALBG);
			statusGraphics(tabObjects[currentTabIndex].content["status"]);
		}
		// if Index is lower than currentTabIndex
		// Decrease by 1 because currentTabIndex is logically changed by deletion.
		if (index < currentTabIndex) {
			currentTabIndex -= 1;
		}

		// Decrease all tab's index by 1 which index data is bigger than 'targetDataIndex'
		for (let i = 0; i < tabObjects.length; i++) {
			if (Number(tabObjects[i].tab.dataset.index) > targetDataIndex) {
				tabObjects[i].tab.dataset.index = Number(tabObjects[i].tab.dataset.index) - 1;
			}
			//tabObjects[i].tab.dataset.index = Number(tabObjects[i].tab.dataset.index) - 1;
		}
	} 
	//if tabObjects' length i 0 then rest currentTabIndex (which is setting to -1)
	else {
		currentTabIndex = -1;
	}
}

// FUNCTION ::: Toggle children elements of directory menu button
function toggleChildren(event) {
	let siblings = new Array();
	let current = event.currentTarget.nextElementSibling;

	while (current !== null ) {
		siblings.push(current);
		current = current.nextElementSibling;
	}

	// If directory does not have any siblings
	// which means there are no itemes to be toggled.
	if (siblings.length == 0) return;

	// Currently folded
	if (fileTree.getNode(event.currentTarget.dataset.path).isFolded) {
		event.currentTarget.textContent = '⌄ ' + path.basename(event.currentTarget.dataset.path);
		siblings.forEach(item => {
			item.classList.remove("hidden");
		});
		fileTree.getNode(event.currentTarget.dataset.path).isFolded =  false;
	} 
	// CUrrently unfolded
	else {
		event.currentTarget.textContent = "> " +path.basename(event.currentTarget.dataset.path);
		siblings.forEach(item => {
			item.classList.add("hidden");
		})
		fileTree.getNode(event.currentTarget.dataset.path).isFolded =  true;
	}
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
		language: 'ko',
		toolbarItems: [
			'heading',
			'bold',
			'italic',
			'strike',
			'divider',
			'hr',
			'quote',
			'divider',
			'ul',
			'ol',
			'task',
			'indent',
			'outdent',
			'divider',
			'table',
			'image',
			'link',
			'divider',
			'code',
			'codeblock',
			'divider',
			{
				type: 'button',
				options: {
					el: elementWithInnerHtml('<i class="fas fa-file-export text-gray-600" style="font-size: 0.65rem;"></i>'),
					event: 'exportTemplate',
					tooltip: 'Export template',
					style: 'background:none;'
				}
			},
			{
				type: 'button',
				options: {
					el: elementWithInnerHtml('<i class="fas fa-file-import text-gray-600" style="font-size: 0.65rem;"></i>'),
					event: 'importTemplate',
					tooltip: 'Import template',
					style: 'background:none;'
				}
			}
		]
	});
	editor.getHtml();
	
	editor.eventManager.addEventType('exportTemplate');
	editor.eventManager.listen('exportTemplate', exportTemplate);
	editor.eventManager.addEventType('importTemplate');
	editor.eventManager.listen('importTemplate', importTemplate);

	return editor;
}

// FUNCTION ::: Create element with given inner html text
function elementWithInnerHtml(innerHtmlText) {
	const button = document.createElement('button');
	button.innerHTML = innerHtmlText;
	button.classList.add("flex", "items-center", "content-center");

	return button;
}

// FUNCTION ::: Import template from template path directory.
function importTemplate() {
	if (currentTabIndex === -1) return;
	let currentTabObject = tabObjects[currentTabIndex];

	// TODO ::: Make this configurable
	// so that people can choose behaviour.
	if (currentTabObject.content.body.length !== 0) {
		alert("Loading template is only possible when current document is empty.");
		return;
	}

	let targetPath;
	let isAbsolute = false;
	if (path.isAbsolute(config.content["templatePath"])) {
		targetPath = config.content["templatePath"];
		isAbsolute = true;
	} else {
		targetPath = path.join(shared.rootDirectory, config.content["templatePath"]);
	}

	if (!fs.existsSync(targetPath)){
		if (isAbsolute) {
			alert("Template path doesn't exist.\nAbsolute path of template is not automatically generated.");
			return;
		}
		fs.mkdirSync(targetPath);
	}

	remote.dialog.showOpenDialog(remote.getCurrentWindow(), {defaultPath: targetPath}).then((response) => {
		if(!response.canceled) {
			// Reset gdml List
			let readContent = fs.readFileSync(response.filePaths[0], 'utf-8');
			currentTabObject.editor.setMarkdown(readContent.toString());
			currentTabObject.contentStatus = UNSAVED;
			currentTabObject.tab.textContent = path.basename(currentTabObject.path) + UNSAVEDSYMBOL;

		}
	});

}

// FUNCTION ::: Export template file as markdown format to template directory.
function exportTemplate() {
	if (currentTabIndex === -1) return;
	let currentTabObject = tabObjects[currentTabIndex];

	let targetPath;
	let isAbsolute = false;
	if (path.isAbsolute(config.content["templatePath"])) {
		targetPath = config.content["templatePath"];
		isAbsolute = true;
	} else {
		targetPath = path.join(shared.rootDirectory, config.content["templatePath"]);
	}
	if (!fs.existsSync(targetPath)){
		if (isAbsolute) {
			alert("Template path doesn't exist.\nAbsolute path of template is not automatically generated.");
			return;
		}
		fs.mkdirSync(targetPath);
	}

	remote.dialog.showSaveDialog(remote.getCurrentWindow(), {defaultPath: targetPath}).then((response) => {
		if(!response.canceled) {
			template.ExportTemplate(currentTabObject.content.body, response.filePath);
		}
	});
}

// FUNCTION ::: Apply Status graphical effect
function statusGraphics(statusString) {
	let statusDiv = tabObjects[currentTabIndex].meta.querySelector("#statusBar");
	if( statusString === "UPTODATE" ) {
		statusDiv.textContent = "Up to date";
		statusDiv.classList.remove(UNDEFINEDCOLOR);
		statusDiv.classList.remove(OUTDATEDTEXTCOLOR);
		statusDiv.classList.add(UPTODATETEXTCOLOR);
	} else if (statusString === "OUTDATED") {
		statusDiv.textContent = "Outdated";
		statusDiv.classList.remove(UNDEFINEDCOLOR);
		statusDiv.classList.add(OUTDATEDTEXTCOLOR);
		statusDiv.classList.remove(UPTODATETEXTCOLOR);
	} else if (statusString === "INDEFINITE") {
		statusDiv.textContent = "Indefinte";
		statusDiv.classList.add(UNDEFINEDCOLOR);
		statusDiv.classList.remove(OUTDATEDTEXTCOLOR);
		statusDiv.classList.remove(UPTODATETEXTCOLOR);
	}
}

// FUNCTION ::: List references button to status bar
function listReferences() {
	// get list of referecnes from the tabObject 
	let references = tabObjects[currentTabIndex].content["reference"]; // This is array
	for( let i =0; i < references.length; i++ ) {
		if (!path.isAbsolute(references[i])) {
			references[i] = path.join(shared.rootDirectory, references[i]);
		}
	}
	tabObjects[currentTabIndex].refs = new Set(references); // TODO ::: THis might be buggy

	references.forEach((ref) => {
		addRefBtn(ref, true);
	});
}

// FUNCTION ::: Add reference button, called from listReferences function.
// This method adds refernces lists to current tab object element.
function addRefBtn(fileName, listing) {
	let currentTabObject = tabObjects[currentTabIndex];

	// If referencing file is same with currentTab then return.
	// it will cause 100% problem.
	if (currentTabObject.path === fileName) return;

	let filePath = fileName;
	if (!path.isAbsolute(filePath)) {
		filePath = path.join(shared.rootDirectory, filePath);
	}

	// If listing is not true then it is adding what is not read from file
	// Mostly from drag and drop addition.
	if (!listing) {
		// if reference already exists then ignore.
		if (currentTabObject.refs.has(filePath)) return;
		// make unsaved
		currentTabObject.refStatus = UNSAVED;
		currentTabObject.tab.textContent = path.basename(currentTabObject.path) + UNSAVEDSYMBOL;
		currentTabObject.refs.add(filePath);
	}

	let divElem = document.createElement('div');
	var elem = document.createElement('button');

	// This might yield error ecause filePath is not possiblye valid yml file.
	let fileYaml;
	try {
		fileYaml = yaml.load(fs.readFileSync(filePath)); 
		// Return and don't add as reference if read file is not a valid gdml.
		if (!gdml.IsValidGdmlString(fileYaml)) {
			currentTabObject.refs.delete(filePath);
			currentTabObject.refStatus = UNSAVED;
			currentTabObject.tab.textContent = path.basename(currentTabObject.path) + UNSAVEDSYMBOL;
			alert("Referencing file is not a valid gdml file.\nIt will be deleted after save.");
			return;
		}
	} catch (err) {
		console.error("Failed to read file content as yaml. Err code : " + err);
		currentTabObject.refs.delete(filePath);
		currentTabObject.refStatus = UNSAVED;
		currentTabObject.tab.textContent = path.basename(currentTabObject.path) + UNSAVEDSYMBOL;
		alert("Referencing file is not a valid gdml file or non existent.\nIt will be deleted after save.");
		return;
	}
	
	let menuColor = UNDEFINEDCOLOR; // Undefined color
	if (fileYaml["status"] == OUTDATED) menuColor = OUTDATEDTEXTCOLOR;
	else menuColor = UPTODATETEXTCOLOR;
	divElem.classList.add(menuColor, "h-full", "mx-2" ,"py-1" ,"px-2" , "text-center", "inline-block" ,"w-auto", "align-middle", "hover:opacity-70");

	elem.textContent = path.basename(filePath);
	elem.dataset.path = filePath;
	elem.addEventListener('click', loadGdmlToEditor);
	elem.classList.add("font-semibold" ,"refBtn");

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

// FUNCTION ::: Create new tab object
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

// FUNCTION ::: Hide Current tab, which is called when another tab is clicked.
function hideCurrentTab() {
	// Hide screen and toggle color of tab Object
	tabObjects[currentTabIndex].screen.style.display = "none";
	tabObjects[currentTabIndex].meta.style.display = "none";
	tabObjects[currentTabIndex].tab.parentElement.classList.remove(...HIGHLIGHT);
	tabObjects[currentTabIndex].tab.parentElement.classList.add(...NORMALBG);
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

// TODO ::: Should check validation of gdml file
// FUNCTION ::: Dragged markdown file or gdml file is 
// pasted into currently bound text editor's content. 
function dropToPasteFile(ev) {
	// Prevent default behavior (Prevent file from being opened)
	ev.preventDefault();

	if (ev.dataTransfer.items) {
		// If dropped items aren't files, reject them
		if (ev.dataTransfer.items[0].kind === 'file') {
			let file = ev.dataTransfer.items[0].getAsFile();
			if (path.extname(file.name).toLowerCase() === ".gdml") {
				file.text().then(item => {
					let currentTabObject = tabObjects[currentTabIndex];
					let content = yaml.safeLoad(item);

					// If not valid then return
					if (!gdml.IsValidGdmlString(content)) {
						alert("Invalid gdml file.")
						return;
					}

					currentTabObject.editor.setMarkdown(content.body);
					currentTabObject.contentStatus = UNSAVED;
					currentTabObject.tab.textContent = path.basename(currentTabObject.path) + UNSAVEDSYMBOL;

				});
			} else if (path.extname(file.name).toLowerCase() === ".md") {
				file.text().then(item => {
					let currentTabObject = tabObjects[currentTabIndex];
					currentTabObject.editor.setMarkdown(item);
					currentTabObject.contentStatus = UNSAVED;
					currentTabObject.tab.textContent = path.basename(currentTabObject.path) + UNSAVEDSYMBOL;
				});
			} else {
				return;
			}
		}
	} 
}
