const electron = require("electron");
const fs = require('fs');
const path = require("path");
const url = require("url");
const yaml = require('js-yaml');

const {app, BrowserWindow, protocol, globalShortcut} = require("electron");
const {dialog} = require('electron');

let win;
// new Gdml File represented as javascript object
const newGdml = {status: 'UPTODATE', reference: new Array(), confirmed_by: "" ,body: ""}
// cache variable
let args = process.argv;

// Each appArgs options are exclusive
// argv[0] is program name so for loop starts from 1 index
for (let i =1; i < args.length; i++) {
	if (args[i] === "-n" || args[i] === "--new") {
		newGdmlFile(i);
	}
	if (args[i] === "-h" || args[i] === "--help") {
		showHelpText();
	}
}

function newGdmlFile(argIndex) {
	let fileName = 'new.gdml';
	if (argIndex !== args.length - 1) {
		fileName = args[argIndex+1];
	}
	//create new file named gdml
	try {
		let fullPath = path.join(process.cwd() + "/" + fileName)
		fs.writeFileSync(fullPath, yaml.safeDump(newGdml));
	} catch (err) {
		console.log("Failed to create file with error : " + err);
	}
	process.exit(1);
}

function showHelpText() {
	let helpText = `Usage: gesign [options] [arguments]
Options:
  -h, --help                                display help text.
  -n, --new <FileName>                      Create new gdml file, default name is new.gdml
  -d, --dir <Directory>                     Open gesign with given directory as current working directory.
`;
	console.log(helpText);
	process.exit(1);
}

// ELECTRON Initiation
function createWindow() {
	win = new BrowserWindow({minWidth: 800, minHeight: 500, webPreferences: {
		nodeIntegration: true,
		enableRemoteModule: true,
		nativeWindowOpen: true
	}});

	win.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: "file",
		slashes: true
	}));

	//win.webContents.openDevTools();
	win.on('closed', () => {
		win = null;
	})

	win.once('ready-to-show', () => {
		win.show();
	});
}

app.on('ready', () => {

	// Create Window
	createWindow();

});

app.on('window-all-closed', () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on('activate', () => {
	if(win === null) {
		createWindow();
	}
});

