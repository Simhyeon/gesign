const path = require("path");
const url = require("url");
const {AppOption} = require('./appOption');

const {app, BrowserWindow} = require("electron");

// TESTING
//app.disableHardwareAcceleration();

// VARIABLE ::: Local window variable
let win;

// INITIALIZATION ::: Cli option related part
let args = process.argv;
let appOption = new AppOption(args);
let processStatus = appOption.flagExecution();
// If processStatus has been returned from closure corresponding to given flags
if (processStatus !== null && processStatus.doExit) {
	// Early Exit program
	process.exit(processStatus.exitStatus);
}

// ELECTRON Initiation
function createWindow() {
	// Config global variable reserved for ipc communication
	global.shared = {
		rootDirectory: null,
		saveConfig: false,
		config: null
	};

	win = new BrowserWindow({
		minWidth: 400, 
		minHeight: 500, 
		width: 1000, 
		height: 800 , 
		webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
			nativeWindowOpen: true
		},
		icon : path.join(__dirname, 'img/icon.png')
	});
	win.setMenuBarVisibility(false);
	win.setAutoHideMenuBar(true);
	win.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: "file",
		slashes: true
	}));

	// If player gave dev flag as first argument
	// open dev tools on startup
	if (args[1] === "--dev") {
		// Dev console window.
		win.webContents.openDevTools();
	}

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

