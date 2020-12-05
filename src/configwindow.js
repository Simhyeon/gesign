'use strict;'

const {remote} = require('electron');
const url = require('url');
const fs = require('fs');
const path = require('path');

module.exports = {
	ConfigWindow : class ConfigWindow {
		constructor() {
			this.win = new remote.BrowserWindow( {minWidth: 600, minHeight: 700, width : 800, height: 800, modal: true, parent: remote.getCurrentWindow()} );

			this.win.loadURL(url.format({
				pathname: path.join(__dirname, 'configwindow.html'),
				protocol: "file",
				slashes: true
			}));

			this.win.webContents.openDevTools();
			this.win.on('closed', () => {
				this.win = null;
			})

			this.win.once('ready-to-show', () => {
				this.win.show();
			});
		}
	}
}
