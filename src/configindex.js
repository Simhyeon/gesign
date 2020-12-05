const path = require('path');
const fs = require('fs');
const config = require('./config');

const saveBtn = document.querySelector("saveConfig");
const defaultBtn = document.querySelector("defaultConfig");
const addRuleBtn = document.querySelector("addExclusionRule");
const addPathBtn = document.querySelector("addTemplatePath");

const templatePath= document.querySelector("");
const fontRadio = document.querySelector("");
const modeRadio = document.querySelector("");
const checkOnSave = document.querySelector("");

saveBtn.addEventListener('click', () => {
	// TODO ::: Get all files from elements and save into config
	// Check sanity of given inputs ; template Path and check on save... etc...
});

defaultBtn.addEventListener('click', () => {

});

addRuleBtn.addEventListener('click', () => {

});

addPathBtn.addEventListener('click', () => {
	// TODO ::: Show dialog
	// TODO ::: Set content of template path into that path.
})

// removeRule is class
document.querySelectorAll(".removeRule").addEventListener('click', (event) => {
	removeRule(event);
});

function removeRule(event) {

}
