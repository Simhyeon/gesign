'use strict';

const fs = require('fs');
const OUTDATED = "OUTDATED";
const UPTODATE = "UPTODATE";
const NOTCHECKED = "NOTCHECKED";

class NodeObject {
	constructor(value, references) {
		var stats = fs.statSync(value);
		var mtime = stats.mtime;

		this.value = value;
		this.level = 0;
		this.status = NOTCHECKED;
		this.lastModified = mtime; // read from filesystem and check it. 
		this.parentList = new Set();
		this.childrenList = new Set();
		if( references !== null ) {
			references.forEach((item) => {
				this.childrenList.add(item);
			});
		}
	}

	//get value() {
		//return this.value;
	//}
	//set value(new_value) {
		//this.value = new_value;
	//}

	//get level() {
		//return this.level;
	//}
	//set level(new_level) {
		//this.level = new_level;
	//}

	//get parentList() {
		//return this.parentList;
	//}

	//get childrenList() {
		//return this.childrenList;
	//}

	//setLevel(level) {
		//this.level = level;
	//}

	addParent(nodeName) {
		this.parentList.add(nodeName);
	}

	addChild(nodeName) {
		this.childrenList.add(nodeName);
	}

	setChildren(nodeNameArray) {
		if( nodeNameArray === null || nodeNameArray.length === 0 ) return;
		this.childrenList = new Set(nodeNameArray);
	}
}

module.exports = {
	Checker : class Checker {
		constructor() {
			this.nodes = new Map();
		}

		// TODO ::: make this set to add parent and children node if non existant
		// COMMENTATION ::: Basic Principle
		// Create node if child node doesn't exist
		//
		// Update Level
		// if newly created (createNew == true) and children already exists then 
		// set level to children's level + 1
		// if not newly created and has newly created single child, then set child's level to
		// current node - 1 
		// if not newly created and has multiple children, then set current node's
		// level to highest child's level + 1
		// TODO ::: References are gien as list of string while nodeObject is currently represented as nodeObject change this
		addNode(value, references) {
			// Add node if doesn't already exist
			let targetNode;
			let createNew = false;

			if(this.getNode(value) === null) {
				targetNode = new NodeObject(value, references);
				this.nodes.set(targetNode.value, targetNode);
				createNew = true;
			} else {
				targetNode = this.getNode(value);
				targetNode.setChildren(references);
			}

			// There can be three statuses
			// 1. all children exists
			// 2. all children dosn't exists
			// 3. complex status
			let existingChildren = new Array();
			let nonExistingChildren = new Array();

			// Has children
			if (targetNode.childrenList.size !== 0) {
				var childrenCache = new Array();
				// Find if children is preexisting or not
				targetNode.childrenList.forEach((item) => {
					// Child node exists
					var childNode = this.getNode(item);
					if(childNode !== null) {
						childNode.addParent(targetNode.value);
						existingChildren.push(childNode);
					}
					// child node doesn't exist
					else {
						childNode = new NodeObject(item, new Array());
						childNode.addParent(targetNode.value);
						nonExistingChildren.push(childNode);
						this.nodes.set(childNode.value, childNode);
					}
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

		recursiveInc(startNodeName, nodeObject) {
			nodeObject.level++;
			Array.from(nodeObject.parentList).forEach((parentName) => {
				let parentNode = this.getNode(parentName);
				if (parentNode.value === startNodeName) {
					throw new Error("Mutual reference detected.");
				}

				this.recursiveInc(startNodeName, parentNode);
			})
		}

		debugPrintAll() {
			console.log(this.nodes);
			console.log(Array.from(this.nodes.values()));
			//Map.values(this.nodes).forEach((item) => {
				//console.log(item);
			//});
		}

		getNode(value) {
			if (this.nodes.has(value)) {
				return this.nodes.get(value);
			} else {
				return null;
			}
		}

		// TODO ::: Currently this is getting argument so taht debugging is easy
		// use of getLevelSortedList function inside of checkDependencies for real production code
		// Check dependencies and return status list(array) according to depdencies' timestamps
		checkDependencies(values) {
			// if no children then set UPTODATE
			// if has children compar timestmamps
			values.forEach((item) => {
				if (item.childrenList.size === 0) {
					console.log("Up to date");
					item.status = UPTODATE;
				} else {
					var isOutdated = Array.from(item.childrenList).some((child) => {
						let node = this.getNode(child); // this should not be null becuase childrenList is added from real Node.
						return (node.status == OUTDATED || item.lastModified.getTime() < node.lastModified.getTime());
					});
					if (isOutdated) item.status = OUTDATED;
					else item.status = UPTODATE;
					console.log("Result status is : " + item.status);
				}
			});
		}

		// Get Level sorted list from map's values
		getLevelSortedList() {
			// Sort by increasing order.
			//
			let values = Array.from(this.nodes.values());

			values.sort((a,b) => {
				return a.level-b.level; // this sorts by increasing order.
			})

			return values;
		}
	},

}
