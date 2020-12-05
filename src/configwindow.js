'use strict;'

const {remote} = require('electron');
const url = require('url');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const shared = require('./shared');

module.exports = {
	ConfigWindow : class ConfigWindow {
		constructor() {
			remote.getGlobal('shared').config = config;
			remote.getGlobal('shared').rootDirectory = shared.rootDirectory; 
			this.win = new remote.BrowserWindow({
				minWidth: 600, 
				minHeight: 700, 
				width : 800, 
				height: 800, 
				modal: true, 
				parent: remote.getCurrentWindow(), 
				webPreferences: {
					nodeIntegration: true,
					enableRemoteModule: true,

				}
			});

			this.win.loadURL(url.format({
				pathname: path.join(__dirname, 'configwindow.html'),
				protocol: "file",
				slashes: true
			}));

			this.win.webContents.openDevTools();
			this.win.on('closed', () => {
				this.win = null;

				// Write changed config to real config file.
				// It is always overwriting even if there was no changes.
				fs.writeFileSync(
					path.join(remote.getGlobal('shared').rootDirectory, "gesign_config.json"), 
					JSON.stringify(remote.getGlobal('shared').config.content, null, 4)
				)
			})

			this.win.once('ready-to-show', () => {
				this.win.show();
			});
		}
	}
}
