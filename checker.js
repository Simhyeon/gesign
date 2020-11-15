'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const gdml = require('./gdml');
const OUTDATED = "OUTDATED";
const UPTODATE = "UPTODATE";
const NOTCHECKED = "NOTCHECKED";
const _ = require('lodash');

let gdmlTags = new Array("status", "reference", "body");

// CLASS ::: Used by Checker class instance
// Saves values needed for dependencies checking.
// TODO :: Change this logic
class NodeObject {
	constructor(value, content) {
		this.value = value;
		this.level = 0;
		this.status = NOTCHECKED;
		this.lastModified = content["lastModified"]; // read from filesystem and check it. 
		this.parentSet = new Set();
		this.childrenSet = new Set();
		if( content["reference"] !== null ) {
			content["reference"].forEach((item) => {
				this.childrenSet.add(item);
			});
		}
	}

	addParent(nodeName) {
		this.parentSet.add(nodeName);
	}

	addChild(nodeName) {
		this.childrenSet.add(nodeName);
	}

	// this replace childrenSet not adding to existing set
	setChildren(nodeNameArray) {
		if( nodeNameArray === null || nodeNameArray.length === 0 ) return;
		this.childrenSet = new Set(nodeNameArray);
	}
}

module.exports = {
	// CLASS ::: Checker class to check dependencies of given nodesMap
	Checker : class Checker {
		constructor() {
			this.nodes = new Map();
		}

		// COMMENT ::: Basic Principle
		// Create node if child node doesn't exist
		// Update Level
		// if newly created (createNew == true) and children already exists then 
		// set level to children's level + 1
		// if not newly created and has newly created single child, then set child's level to
		// current node - 1 
		// if not newly created and has multiple children, then set current node's
		// level to highest child's level + 1
		// METHOD ::: Add node to nodesMap
		addNode(value, content) {
			// Add node if doesn't already exist
			let targetNode;
			let createNew = false;

			// If node doesn't exists
			if(this.getNode(value) === null) {
				targetNode = new NodeObject(value, content);
				this.nodes.set(targetNode.value, targetNode);
				createNew = true;
			} else {
				targetNode = this.getNode(value);
				targetNode.lastModified = content["lastModified"];
				targetNode.setChildren(content["reference"]);
			}

			// There can be three statuses
			// 1. all children exists
			// 2. all children dosn't exists
			// 3. complex status, some exists some doesn't
			let existingChildren = new Array();
			let nonExistingChildren = new Array();

			// Has children
			if (targetNode.childrenSet.size !== 0) {
				var childrenCache = new Array();
				// Find if children is preexisting or not
				targetNode.childrenSet.forEach((item) => {
					// Child node exists
					var childNode = this.getNode(item);
					if(childNode !== null) {
						childNode.addParent(targetNode.value);
						existingChildren.push(childNode);
					}
					// child node doesn't exist
					else {
						childNode = new NodeObject(item, gdml.newGdml());
						childNode.addParent(targetNode.value);
						nonExistingChildren.push(childNode);
						this.nodes.set(childNode.value, childNode);
					}
					// Push childrenNode to cache  and add child to childrenSet of targetNode
					childrenCache.push(childNode);
					targetNode.addChild(childNode.value);
				});

				// set parent node's level first and set unreferences child's level
				if (existingChildren.length !== 0 && nonExistingChildren.length !== 0) {
					let highestLevel = existingChildren[0].level;
					existingChildren.forEach((item) => {
						if (item.level > highestLevel) {
							highestLevel = item.level;
						}
					});

					if (createNew) targetNode.level = highestLevel + 1;
					else {
						targetNode.level = highestLevel;
						this.recursiveInc(targetNode.value, targetNode);
					}

					nonExistingChildren.forEach((item) => {
						item.level = highestLevel;
					});

				} else if (existingChildren.length !== 0) {
					let highestLevel = existingChildren[0].level;
					existingChildren.forEach((item) => {
						if (item.level > highestLevel) {
							highestLevel = item.level;
						}
					});

					if (createNew) {
						targetNode.level = highestLevel + 1;
					} else {
						targetNode.level = highestLevel;
						this.recursiveInc(targetNode.value, targetNode);
					}

				} else if (nonExistingChildren.length !== 0) {
					nonExistingChildren.forEach((item) => {
						item.level = targetNode.level - 1;
					});
				}
			}
		}

		// FUNCTION ::: Increase level by 1 recursively following parents
		// If recursive reference detected throw exception 
		recursiveInc(startNodeName, nodeObject) {
			nodeObject.level++;
			Array.from(nodeObject.parentSet).forEach((parentName) => {
				let parentNode = this.getNode(parentName);
				// Mututal reference detected throw file name to caller
				if (parentNode.value === startNodeName) {
					throw new Error(startNodeName + " is referencing itself.");
				}

				this.recursiveInc(startNodeName, parentNode);
			})
		}

		// DEBUG || FUNCTION ::: Debugging function to print nodesMap
		debugPrintAll() {
			console.log(this.nodes);
			console.log(Array.from(this.nodes.values()));
			//Map.values(this.nodes).forEach((item) => {
				//console.log(item);
			//});
		}

		// FUNCTION ::: get node by value from nodeMap
		getNode(value) {
			if (this.nodes.has(value)) {
				return this.nodes.get(value);
			} else {
				return null;
			}
		}

		// TODO ::: Currently this is getting argument so taht debugging is easy
		// use of getLevelSortedList function inside of checkDependencies for real production code
		// FUNCTION ::: Check dependencies and return status list(array) according to dependencies' timestamps and status
		checkDependencies() {
			let values = this.getLevelSortedList();
			//console.log("VAlue is ");
			//console.log(JSON.parse(JSON.stringify(values)));
			values.forEach((item) => {
				//console.log("Checking file ->");
				//console.log(item);
				// if no children then set UPTODATE
				if (item.childrenSet.size === 0) {
					item.status = UPTODATE;
				} 
				// if has children compare timestmamps
				else {
					var isOutdated = Array.from(item.childrenSet).some((child) => {
						let node = this.getNode(child); // this should not be null becuase childrenSet is added from real Node.
						return (node.status == OUTDATED || item.lastModified < node.lastModified);
					});
					if (isOutdated) item.status = OUTDATED;
					else item.status = UPTODATE;
				}

				//console.log("after check");
				//console.log(item);
			});

			//console.log("List after checking");
			//console.log(values);
			return values;
		}

		// FUNCTION ::: Get Level sorted list from map's values
		// Sort by increasing order. lowest order comes first.
		getLevelSortedList() {
			let values = Array.from(this.nodes.values());

			// TODO ::: Replace with lowdash
			values.sort((a,b) => {
				if ( a.level < b.level ){
					return -1;
				}
				if ( a.level > b.level ){
					return 1;
				}
				return 0;
			});

			//console.log("After");
			//console.log(values);

			return values;
		}
	},
	// FUNCTION ::: Check references in headless state. (wihtout gui)
	HeadLessChecker : class HeadLessChecker {

	},
	// FUNCTION ::: 
	IsValidGdml : function(fullPath)  {
		let result = null;
		if (path.extname(fullPath) !== ".gdml") return false;
		try {
			result = yaml.load(fs.readFileSync(fullPath));
		} catch {
			return false;
		}
		let isValid = true;

		if (result === null || result === undefined) {
			return false;
		}

		gdmlTags.forEach((tag) => {
			if (result[tag] === null || result[tag] === undefined ) {
				isValid = false;
			}
		});
		return isValid;
	}
}
