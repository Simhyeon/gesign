'use strict;'

const path = require('path');
const fs = require('fs');
const DIRECTORY = "DIRECTORY";
const FILE = "FILE";

// CLASS :: File node that stores information of file
// such as file types(e.g directory or gdml file)
// or if directory is folded or not.
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
	// CLASS :: File Tree class that stores all gdml file and directory nodes read from working directory.
	FileTree : class FileTree {
		// CONSTRUCTOR :: initiate root node.
		constructor(rootPath) {
			this.rootDirectory = rootPath.split(path.sep);
			this.rootNode = new FileNode(rootPath, true);
		}

		// FUNCTION ::: Initiate node
		// This function creates node if doesn't exist
		// if given filepath doesn't match with root directory
		// then ignore.
		initNode(filePath, element) {

			// Follow path list and create if not found.
			// Cache basename for loop end.
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

		// FUNCTION ::: Literally remove node from tree
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

		// FUNCTION ::: Literally get node from tree
		// Return true if node was found.
		getNode(filePath) {
			let parsed = filePath.split(path.sep);
			for(let i= 0; i < this.rootDirectory.length; i++) {
				if (this.rootDirectory[i] !== parsed[i]) {
					console.error("Can't add node with different rootDirectory");
					return undefined;
				}
			}

			let currentNode = this.rootNode;
			for(let i = this.rootDirectory.length; i < parsed.length; i++) {
				let nextNode = this.checkNode(currentNode, parsed[i]);
				if (nextNode === null) {
					console.log("Returning null");
					return null;
				}
				currentNode = nextNode;
			}
			return currentNode;
		}

		// FUNCTION ::: Check if parent node has child node which has given baseName
		// Called on node-watch file change or remove
		checkNode(nodeParent, baseName) {
			let node = 
				nodeParent.children.find( element => element.name === baseName);
			if (node === undefined) return null;
			return node;
		}

		// FUNCTION ::: Create new node
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
