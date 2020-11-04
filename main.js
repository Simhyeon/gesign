const electron = require("electron");
const path = require("path");
const url = require("url");

const {app, BrowserWindow, protocol} = require("electron");
const {dialog} = require('electron');

let win;


// ELECTRON Initiation
function createWindow() {
	win = new BrowserWindow({minWidth: 800, minHeight: 500, webPreferences: {
		nodeIntegration: true,
		enableRemoteModule: true
	}});

	win.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: "file",
		slashes: true
	}));

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

