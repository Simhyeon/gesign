const path = require('path');
const fs = require('fs');
const {remote} = require("electron");

const saveBtn = document.querySelector("#saveConfig");
const defaultBtn = document.querySelector("#defaultConfig");
const addRuleBtn = document.querySelector("#addExclusionRule");
const addPathBtn = document.querySelector("#addTemplatePath");

const templatePathElem= document.querySelector("#templatePath");
const exclusionRoot = document.querySelector("#exclusionList");
const unpinAuto = document.querySelector("#unpinAuto");
//const checkOnSave = document.querySelector("");

const config = remote.getGlobal('shared').config.content;
const rootDirectory = remote.getGlobal('shared').rootDirectory;

// INI ::: Initizliation should be done at start.
init();

// EVENT ::: Save config file button
saveBtn.addEventListener('click', () => {
	// TODO ::: Get all files from elements and save into config
	// Check sanity of given inputs ; template Path and check on save... etc...
	
	// Check if template path exists.
	// Template directory is automatically generated and should be validated.
	// while exclusion rules are optional and don't have to valid.
	let templatePath = null;
	try {

		let htmlValue = templatePathElem.innerHTML;
		if (htmlValue !== "" && !path.isAbsolute(htmlValue)) {
			htmlValue = path.join(rootDirectory, htmlValue);
		}

		if (fs.existsSync(htmlValue) || templatePathElem.innerHTML.textContent === "") {
			templatePath = templatePathElem.innerHTML;
		} else {
			alert("Template path doesn't exist.");
			templatePathElem.focus();
			return;
		}
	} catch (err) {
		alert("Template path doesn't exist. Err : " + err);
		return;
	}

	let exElems = exclusionRoot.querySelectorAll(".excItem");
	let exclusionlist = new Array();
	exElems.forEach(item => {
		exclusionlist.push(item.innerHTML);
	});

	remote.getGlobal('shared').config.content.templatePath = templatePath;
	remote.getGlobal('shared').config.content.exclusion = exclusionlist;
	remote.getGlobal('shared').config.content.startMode = 
		document.querySelector('input[name="startMode"]:checked').value;
	remote.getGlobal('shared').config.content.fontSize = 
		document.querySelector('input[name="fontSize"]:checked').value;
	remote.getGlobal('shared').config.content.unpinAuto = unpinAuto.checked;
	remote.getGlobal('shared').saveConfig = true;

	remote.getCurrentWindow().close();
});

// EVENT ::: Set config as default
defaultBtn.addEventListener('click', () => {
	document.querySelector("#startWysiwyg").checked = true;
	document.querySelector("#fontSmall").checked = true;
	templatePathElem.innerHTML = path.join(rootDirectory, "templates");
});

// EVENT ::: Add exlucion rule.
addRuleBtn.addEventListener('click', () => {
	addExclusionRule();
});

// EVENT ::: Add template path from dialog.
addPathBtn.addEventListener('click', () => {
	remote.dialog.showOpenDialog(remote.getCurrentWindow(),{defaultPath: rootDirectory, properties: ["openDirectory"]}).then((response) => {
		if(!response.canceled) {
			templatePathElem.innerHTML = response.filePaths[0];
		}
	});

})

// FUNCTION ::: Initialize multiple dom objects based on config read from main process.
function init() {
	// StartMode
	if (config.startMode === "markdown") {
		document.querySelector("#startMarkdown").checked = true;
	} else if (config.startMode === "wysiwyg"){
		document.querySelector("#startWysiwyg").checked = true;
	} else {
		console.log(config.startMode);
	}

	// Fontsize
	if (config.fontSize === "small") {
		document.querySelector("#fontSmall").checked = true;
	} else if (config.fontSize === "middle"){
		document.querySelector("#fontMiddle").checked = true;
	} else if (config.fontSize === "large"){
		document.querySelector("#fontLarge").checked = true;
	}

	// Template path
	templatePathElem.innerHTML = config.templatePath;
	
	// Exclusion rules
	config.exclusion.forEach(item => {
		addExclusionRule(item);
	});

	// Unpin Auto
	unpinAuto.checked = config.unpinAuto;
}

// FUNCTION ::: Add exclusion rule and set multiple CSS classes
function addExclusionRule(path = "") {
	let rootElem = document.createElement('div');
	rootElem.classList.add("flex", "justify-between");

	let divElem = document.createElement('div');
	divElem.classList.add( "m-1", "px-2" ,"py-1" ,"overflow-x-auto" ,"whitespace-nowrap" ,"mr-4" ,"w-full", "excItem");
	divElem.spellcheck = false;
	divElem.contentEditable = true;
	divElem.innerHTML = path;

	divElem.addEventListener('focusout', (event) => {
		console.log( JSON.parse(JSON.stringify(event.currentTarget.innerHTML)) );
		console.log( JSON.parse(JSON.stringify(event.currentTarget.textContent)) );
		if (event.currentTarget.textContent === "") event.currentTarget.parentElement.remove();
	})

	let deleteButton = document.createElement('button');
	let indicator = document.createElement('i');
	deleteButton.classList.add( "hover:opacity-75" , "mr-2" ,"h-auto" );
	indicator.classList.add( "removeRule", "far" ,"fa-trash-alt");

	deleteButton.addEventListener('click', (event) => {
		event.currentTarget.parentElement.remove();
	});

	rootElem.appendChild(divElem);
	rootElem.appendChild(deleteButton);
	deleteButton.appendChild(indicator);

	exclusionRoot.appendChild(rootElem);

	divElem.focus();
}
