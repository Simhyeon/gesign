const path = require("path");
const url = require("url");
const {AppOption} = require('./appOption');

const {app, BrowserWindow} = require("electron");

// TESTING
app.disableHardwareAcceleration();

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

