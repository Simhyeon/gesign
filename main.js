const electron = require("electron");
const fs = require('fs');
const path = require("path");
const url = require("url");
const yaml = require('js-yaml');
const cli = require('./cli');
const {CliOption} = require('./cli');
const {Config} = require('./config');
const {Checker} = require("./checker");

const {app, BrowserWindow, protocol, globalShortcut} = require("electron");
const {dialog} = require('electron');

let win;

let rootDirectory;

// INITIALIZATION ::: Cli option related part
let args = process.argv;
cli.init(args);
let mainCliOptions = new Array(
	{shortOp: "-n", longOp: "--new", action: newGdmlFile, actionArg: null},
	{shortOp: "-h", longOp: "--help", action: showHelpText, actionArg: null},
	{shortOp: null, longOp: "--valid", action: checkValidation, actionArg: null}, // -v is reserved for version
	{shortOp: null, longOp: "--init", action: initConfig, actionArg: null},
	{shortOp: null, longOp: "--check", action: checkDependencies, actionArg: null}
)

for (let i = 0; i < mainCliOptions.length; i++) {
	let argIndex = cli.getFlagArgIndex(mainCliOptions[i]);
	if (argIndex !== null) {
		mainCliOptions[i].actionArg = args[argIndex];
	}
	cli.execFlagAction(mainCliOptions[i]);
}

function checkValidation(fileName = null) {
	if (fileName === null) {
		console.log("Please give a file path to check validation");
		process.exit(0);
	} else {
		let fullPath = fileName;
		if (!path.isAbsolute(fileName)) {
			fullPath = path.join(process.cwd(), fileName);
		}

		if (checker.IsValidGdml(fullPath)) {
			console.log("File : " + fileName + " is a valid gdml file.");
		} else {
			console.log("File : " + fileName + " is not a valid gdml file.");
		}

		process.exit(0);
	}
}

function initConfig(dirName = null) {
	let config = new Config();
	let fileName = "gesign_config.json";
	if (dirName !== null && !path.isAbsolute(dirName)) 
		fileName = path.join(dirName, fileName);

	if (dirName === null || dirName == "./" || dirName == ".")
		fileName = path.join(process.cwd(), fileName);

	try {
		if (!fs.existsSync(fileName)) {
			console.log("Createing file to :" + fileName);
			fs.writeFileSync(fileName, JSON.stringify(config.default(), null, "\t"));
		} else {
			console.log("Directory already has config file.");
		}
	} catch(err) {
		console.log("Failed to init directory with error : " + err);
	}

	process.exit(0);
}

function newGdmlFile(name = null) {
	// new Gdml File represented as javascript object
	let newGdml = {status: 'UPTODATE', reference: new Array(),body: ""}
	let fileName = 'new.gdml';
	if (name !== null) {
		fileName = name;
	}
	//create new file named gdml
	try {
		let fullPath = path.join(process.cwd(), fileName)
		fs.writeFileSync(fullPath, yaml.safeDump(newGdml));
	} catch (err) {
		console.log("Failed to create file with error : " + err);
	}
	process.exit(0);
}

function checkDependencies(directory = null) {
	let config = new Config();
	config.readFromFile(path.join(directory, "gesign_config.json"));

	if (directory === null) {
		console.log("You should give a directory to check depedencies");
		process.exit(0);
	}

	// TODO ::: If directory is relative then make it to absolute 
	if (!path.isAbsolute(directory)) {
		directory = path.join(process.cwd(), directory);
	}

	rootDirectory = directory;

	let files = fs.readdirSync(directory);
	let gdmlList = new Array();

	listGdml(gdmlList,config, directory, files);

	let checker = new Checker();
	gdmlList.forEach((item) => {
		checker.addNode(item.path, item.content["reference"]);
	})
	// TODO ::: Foreach add all nodes
	let checkerList = checker.checkDependencies();

	// Sort both checkerList and totlaGdmlList by path(value).
	// Order is not important, becuase two list will always have same list of paths. 
	gdmlList.sort((a,b) => {
		if ( a.path < b.path ){
			return -1;
		}
		if ( a.path > b.path ){
			return 1;
		}
		return 0;
	});
	checkerList.sort((a,b) => {
		if ( a.value < b.value ){
			return -1;
		}
		if ( a.value > b.value ){
			return 1;
		}
		return 0;
	});


	// TODO ::: Should change statuses of menu buttons 
	// In first sight it should be ok becuase fs filewatch will detect status change and will
	// read from root Directory.
	// Should change statues of opened tabs
	for (let j = 0, leng = gdmlList.length; j < leng; j++) {
		// If Status has changed after dependency check, apply changes to file
		// With this approcah caching(memory usage) is minified and I/O is maximized.
		if (gdmlList[j].content["status"] !== checkerList[j].status) {
			gdmlList[j].content["status"] = checkerList[j].status;
			fs.writeFileSync(gdmlList[j].path, yaml.safeDump(gdmlList[j].content), 'utf8');
		}
	}

	process.exit();
}

function listGdml(gdmlList, config, root, files) {
	// Directory is shown first and files are shown later.
	let dirsArray = files.filter(file => fs.lstatSync(path.join(root, file)).isDirectory());
	let filesArray = files.filter(file => !fs.lstatSync(path.join(root, file)).isDirectory());

	dirsArray.forEach((file) => {
		if (config.getExclusionRules().find(rule => path.join(rootDirectory, rule) === path.join(root, file)) !== undefined) {
			console.log("Found exclusion rule ignoring file : " + file);
			return;
		}

		listDirectory(gdmlList, config, root, path.basename(file));
	})

	filesArray.forEach((file) => {
		if (config.getExclusionRules().find(rule => path.join(rootDirectory, rule) === path.join(root, file)) !== undefined) {
			console.log("Found exclusion rule ignoring file : " + file);
			return;
		}

		if (path.extname(file).toLowerCase() === ".gdml") {
			listFile(gdmlList, root, path.basename(file));
		} 
	})
}

// FUNCTION ::: Create File menu button
function listFile(gdmlList, root, fileName) {
	let fullPath = path.join(root , fileName);
	let fileYaml = yaml.load(fs.readFileSync(fullPath), 'utf8'); // this should not fail becuase it was read from readdirSync
	gdmlList.push({ path: fullPath, content: fileYaml});
}

// FUNCTION ::: Create directory menu button
function listDirectory(gdmlList, config,root, dirName) {
	let fullPath = path.join(root, dirName);
	fs.readdir(fullPath, (err, files) => {
		if(err) {
			console.log("Failed to read recursive files in directory");
		} else {
			listGdml(gdmlList,config, fullPath, files);
		}
	});
}

function showHelpText() {
	let helpText = `Usage: gesign [options] [arguments]
Options:
  -h, --help                                display help text.
  -n, --new <FileName>                      Create new gdml file, default name is new.gdml
  -d, --dir <Directory>                     Open gesign with given directory as current working directory.
      --valid <FileName>                    Check if file is valid gdml file.
      --init <Directory>                    Create config file in given directory default is current working directory.
      --check <Directory>                   Check gdml document depedencies and update status.
`;
	console.log(helpText);
	process.exit(0);
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

