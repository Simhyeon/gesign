const fs = require('fs');
const path = require("path");
const yaml = require('js-yaml');
const cli = require('./cli');
const {Config} = require('./config');
const checker = require("./checker");
const gdml = require("./gdml");
const {Checker} = require("./checker");

// CLASS :: Saves process status which determines process should exit or not and also exit code.
class ProcessStatus {
	constructor(doExit, exitStatus) {
		this.doExit = doExit;
		this.exitStatus = exitStatus;
	}
}

// TODO ::: Check if given argument is valid e.g if directory or if file is needed.
module.exports = {
	// CLASS ::: Logics reatled to parsing application specific options (unlike '--dir' which is related to editor features)
	AppOption : class AppOption {
		constructor(args) {

			cli.init(args);

			this.rootDirectory = null;
			this.args = args;
			// Create cli options.
			this.mainCliOptions = new Array(
				{shortOp: "-n", longOp: "--new", action: this.newGdmlFile.bind(this), actionArg: null},
				{shortOp: "-h", longOp: "--help", action: this.showHelpText.bind(this), actionArg: null},
				{shortOp: null, longOp: "--valid", action: this.checkValidation.bind(this), actionArg: null}, // -v is reserved for version
				{shortOp: null, longOp: "--init", action: this.initConfig.bind(this), actionArg: null},
				{shortOp: null, longOp: "--check", action: this.checkDependencies.bind(this), actionArg: null}
			);
			
		}

		// FUNCTION ::: Execute flag related functions and return processStatus yielded from function.
		flagExecution() {
			let tentativeResult;
			for (let i = 0; i < this.mainCliOptions.length; i++) {
				let argIndex = cli.getFlagArgIndex(this.mainCliOptions[i]);
				if (argIndex !== null) {
					this.mainCliOptions[i].actionArg = this.args[argIndex];
				}

				// Options are mutually exclusive
				tentativeResult = cli.execFlagAction(this.mainCliOptions[i]);
				if (tentativeResult !== null) {
					return tentativeResult;
				}
			}

			return null;
		}

		// FUNCTION ::: Display help text
		showHelpText() {
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
			return new ProcessStatus(true, 0);
		}

		// FUNCTION ::: Check if gien file is valid gdml file in other words if necessary tags are all inside of the file.
		checkValidation(fileName = null) {
			if (fileName === null) {
				console.log("Please give a file path to check validation");
				return new ProcessStatus(true, 0);
			} else {
				let fullPath = fileName;
				if (!path.isAbsolute(fileName)) {
					fullPath = path.join(process.cwd(), fileName);
				}

				try {
					fs.lstatSync(fullPath);
				} catch {
					console.log("Please give a file path to check validation");
					return new ProcessStatus(true, 0);
				}

				if (checker.IsValidGdml(fullPath)) {
					console.log("File : " + fileName + " is a valid gdml file.");
				} else {
					console.log("File : " + fileName + " is not a valid gdml file.");
				}

				return new ProcessStatus(true, 0);
			}
		}

		// FUNCTION ::: Create new config file in cwd or given directory.
		initConfig(dirName = null) {
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

			return new ProcessStatus(true, 0);
		}

		// FUNCTION ::: Create new gdml file to given directory with given name
		newGdmlFile(name = null) {
			// new Gdml File represented as javascript object
			let newGdml = gdml.newGdml();
			let fileName = 'new.gdml';
			if (name !== null) {
				fileName = name;
			}
			//create new file named gdml
			try {
				let fullPath = name;
				if (!path.isAbsolute(name)) {
					fullPath = path.join(process.cwd(), fileName)
				}
				fs.writeFileSync(fullPath, yaml.safeDump(newGdml));
			} catch (err) {
				console.log("Failed to create file with error : " + err);
			}
			return new ProcessStatus(true, 0);
		}

		// FUNCTION ::: Check dependencies of documents read from root Directory.
		// This function saves updated status into read files.
		checkDependencies(directory = null) {
			if (directory === null || !fs.lstatSync(directory).isDirectory()) {
				console.log("You should give a directory to check depedencies");
				return new ProcessStatus(true, 0);
			}

			let config = new Config();
			config.readFromFile(path.join(directory, "gesign_config.json"));


			// TODO ::: If directory is relative then make it to absolute 
			if (!path.isAbsolute(directory)) {
				directory = path.join(process.cwd(), directory);
			}

			this.rootDirectory = directory;

			let files = fs.readdirSync(directory);
			let gdmlList = new Array();

			this.listGdml(gdmlList, config, directory, files);

			let checker = new Checker();
			gdmlList.forEach((item) => {
				checker.addNode(item.path, item.content);
			})
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

			for (let j = 0, leng = gdmlList.length; j < leng; j++) {
				// If Status has changed after dependency check, apply changes to file
				// With this approcah caching(memory usage) is minified and I/O is maximized.
				if (gdmlList[j].content["status"] !== checkerList[j].status) {
					gdmlList[j].content["status"] = checkerList[j].status;
					fs.writeFileSync(gdmlList[j].path, yaml.safeDump(gdmlList[j].content), 'utf8');
				}
			}

			return new ProcessStatus(true,0);
		}

		listGdml(gdmlList, config, root, files) {
			// Directory is shown first and files are shown later.
			let dirsArray = files.filter(file => fs.lstatSync(path.join(root, file)).isDirectory());
			let filesArray = files.filter(file => !fs.lstatSync(path.join(root, file)).isDirectory());

			dirsArray.forEach((file) => {
				if (config.getExclusionRules().find(rule => path.join(this.rootDirectory, rule) === path.join(root, file)) !== undefined) {
					console.log("Found exclusion rule ignoring file : " + file);
					return;
				}

				this.listDirectory(gdmlList, config, root, path.basename(file));
			})

			filesArray.forEach((file) => {
				if (config.getExclusionRules().find(rule => path.join(this.rootDirectory, rule) === path.join(root, file)) !== undefined) {
					console.log("Found exclusion rule ignoring file : " + file);
					return;
				}

				if (path.extname(file).toLowerCase() === ".gdml") {
					this.listFile(gdmlList, root, path.basename(file));
				} 
			})
		}

		// FUNCTION ::: List read file into gdmlList
		listFile(gdmlList, root, fileName) {
			let fullPath = path.join(root , fileName);
			let fileYaml = yaml.load(fs.readFileSync(fullPath), 'utf8'); // this should not fail becuase it was read from readdirSync
			gdmlList.push({ path: fullPath, content: fileYaml});
		}

		// FUNCTION ::: Read files from given directory so that listFile function can add gdml file to gdmlList varaible.
		listDirectory(gdmlList, config,root, dirName) {
			let fullPath = path.join(root, dirName);
			fs.readdir(fullPath, (err, files) => {
				if(err) {
					console.log("Failed to read recursive files in directory");
				} else {
					this.listGdml(gdmlList,config, fullPath, files);
				}
			});
		}
	}
}


