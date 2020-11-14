const electron = require("electron");
const fs = require('fs');
const path = require("path");
const url = require("url");
const yaml = require('js-yaml');
const cli = require('./cli');
const checker = require('./checker');
const {CliOption} = require('./cli');
const {Config} = require('./config');

const {app, BrowserWindow, protocol, globalShortcut} = require("electron");
const {dialog} = require('electron');

let win;
let config = new Config();
// new Gdml File represented as javascript object
const newGdml = {status: 'UPTODATE', reference: new Array(),body: ""}

// INITIALIZATION ::: Cli option related part
let args = process.argv;
cli.init(args);
let mainCliOptions = new Array(
	{shortOp: "-n", longOp: "--new", action: newGdmlFile, actionArg: null},
	{shortOp: "-h", longOp: "--help", action: showHelpText, actionArg: null},
	{shortOp: null, longOp: "--check", action: checkValidation, actionArg: null},
	{shortOp: null, longOp: "--init", action: initConfig, actionArg: null}
)

for (let i = 0; i < mainCliOptions.length; i++) {
	let argIndex = cli.getFlagArgIndex(mainCliOptions[i]);
	if (argIndex !== null) {
		mainCliOptions[i].actionArg = args[argIndex];
	}
	cli.execFlagAction(mainCliOptions[i]);
}

function checkValidation(fileName = null) {
	if (fileName === null) {
		console.log("Please give a file path to check validation");
		process.exit(0);
	} else {
		let fullPath = fileName;
		if (!path.isAbsolute(fileName)) {
			fullPath = path.join(process.cwd(), fileName);
		}

		if (checker.IsValidGdml(fullPath)) {
			console.log("File : " + fileName + " is a valid gdml file.");
		} else {
			console.log("File : " + fileName + " is not a valid gdml file.");
		}

		process.exit(0);
	}
}

function initConfig(dirName = null) {
	let fileName = "gesign_config.json";
	if (dirName !== null && !path.isAbsolute(dirName)) 
		fileName = path.join(dirName, fileName);

	if (dirName === null || dirName == "./" || dirName == ".")
		fileName = path.join(process.cwd(), fileName);

	try {
		if (!fs.existsSync(fileName)) {
			console.log("Createing file to :" + fileName);
			fs.writeFileSync(fileName, JSON.stringify(config.default(), null, "\t"));
		} else {
			console.log("Directory already has config file.");
		}
	} catch(err) {
		console.log("Failed to init directory with error : " + err);
	}

	process.exit(0);
}

function newGdmlFile(name = null) {
	let fileName = 'new.gdml';
	if (name !== null) {
		fileName = name;
	}
	//create new file named gdml
	try {
		let fullPath = path.join(process.cwd(), fileName)
		fs.writeFileSync(fullPath, yaml.safeDump(newGdml));
	} catch (err) {
		console.log("Failed to create file with error : " + err);
	}
	process.exit(0);
}

function showHelpText() {
	let helpText = `Usage: gesign [options] [arguments]
Options:
  -h, --help                                display help text.
  -n, --new <FileName>                      Create new gdml file, default name is new.gdml
  -d, --dir <Directory>                     Open gesign with given directory as current working directory.
      --check <FileName>                    Check if file is valid gdml file.
      --init <Directory>                    Create config file in given directory default is current working directory.
`;
	console.log(helpText);
	process.exit(0);
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

	// Dev dev console window.
	win.webContents.openDevTools();
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

