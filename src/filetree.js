'use strict;'

const path = require('path');
const fs = require('fs');
const DIRECTORY = "DIRECTORY";
const FILE = "FILE";

class FileNode {
	constructor(baseName, fileType, element) {
		this.element = element;
		this.name = path.basename(baseName);
		this.children = new Array();
		this.fileType = fileType;
		this.isFolded = false;
	}
}

module.exports = {
	FileTree : class FileTree {
		constructor(rootPath) {
			this.rootDirectory = rootPath.split(path.sep);
			this.rootNode = new FileNode(rootPath, true);
		}

		// Called on set root directory
		initNode(filePath, element) {
			// TODO ::: Parse filPath into parsed list
			// Follow path list and create if not found.
			// Cache basename for loop end.
			//let parsed = path.parse(filePath);
			let parsed = filePath.split(path.sep);

			for(let i= 0; i < this.rootDirectory.length; i++) {
				if (this.rootDirectory[i] !== parsed[i]) {
					console.error(this.rootDirectory[i]);
					console.error(parsed[i]);
					console.error("Can't add node with different rootDirectory");
					return;
				}
			}

			let currentNode = this.rootNode;
			for(let i = this.rootDirectory.length; i < parsed.length; i++) {
				let nextNode = this.checkNode(currentNode, parsed[i]);
				if (nextNode === null) {
					nextNode = this.createNode(currentNode, parsed[i]);
				}
				currentNode = nextNode;
			}
		}

		removeNode(filePath) {
			let parsed = filePath.split(path.sep);

			for(let i= 0; i < this.rootDirectory.length; i++) {
				if (this.rootDirectory[i] !== parsed[i]) {
					console.error(this.rootDirectory[i]);
					console.error(parsed[i]);
					console.error("Can't add node with different rootDirectory");
					return;
				}
			}

			let parentNode = null;
			let currentNode = this.rootNode;

			for(let i = this.rootDirectory.length; i < parsed.length; i++) {
				let nextNode = this.checkNode(currentNode, parsed[i]);
				if (nextNode === null) {
					console.error("Undfined behaviour detected returning from removing node.");
					return;
				}
				parentNode = currentNode;
				currentNode = nextNode;
			}

			// Final currentNode is baseName of the given filePath
			// TODO ::: Not sure this is optimal to do this.
			// Remove node from children list,
			// so that garbage collector can collect later.
			parentNode.children.splice(parentNode.children.indexOf(currentNode), 1);
		}

		// Return true if node was found.
		getNode(filePath) {
			let parsed = filePath.split(path.sep);
			for(let i= 0; i < this.rootDirectory.length; i++) {
				if (this.rootDirectory[i] !== parsed[i]) {
					console.error("Can't add node with different rootDirectory");
					return null;
				}
			}

			let currentNode = this.rootNode;
			for(let i = this.rootDirectory.length; i < parsed.length; i++) {
				let nextNode = this.checkNode(currentNode, parsed[i]);
				if (nextNode === null) {
					return null;
				}
				currentNode = nextNode;
			}
			return currentNode;
		}

		// Called on node-watch file change or remove
		checkNode(nodeParent, baseName) {
			let node = 
				nodeParent.children.find( element => element.name === baseName);
			if (node === undefined) return null;
			return node;
		}

		createNode(nodeParent, baseName, element) {
			let fileType = FILE;
			if (path.extname(baseName) === '') fileType = DIRECTORY;

			// console.log("Creating node with : " + baseName);
			let newNode = new FileNode(baseName ,fileType, element);
			nodeParent.children.push(newNode);
			return newNode;
		}
	}
}
