# Gesign is deprecated

Gesign will not be developed from deprecation.

Refer [Rif](https://github.com/simhyeon/rif) if you want to use much more
modular and adaptive file references checking functionality.

# Gesign
Game design document editor

## Abstract
Gesign is composed of two parts. Gesign editor and gdml format.

Gesign editor is an electron application that enables easy editing of gdml file. Gesign is made of pure javascript and several modules including [ToastUIEditor](https://github.com/nhn/tui.editor). Editor reads files from given directory and check if references(dependencies) are all resovled or not. It is easily distinguishable by color so that user can identify which documents are outdatd or up-to-date, and also check referring document's status. 

Gdml format is just a yaml file with predefined tags. Gdml format consists of meta information and markdown content as a body.

## Gdml specification
- **status** : either OUTDATED or UPTODATE
- **lastModified** : File timestamp written in epoch time
- **reference** : array(list) of directories
- **body** : document written in format of markdown(gfm).

#### e.g
```yaml
status: UPTODATE
lastModified: 1605453412608 
reference: 
- /path/to/target/file.gdml
- /file/that/should/be/ref/checked.gdml
- /path/should/be/absolute/and/valid/gdml/file.gdml
body: |-
  ### This is header
  <br>
  **This is bold**

  - List1
  - List2
```

## Technical reasoning

#### Mindset behind gdml
Game design documents get deprecated very fast and it is hard to make documents up to date. To fix this problem, I thought making documents modular and able to reference each other is necessary.

#### yaml
I chose to use yaml(gdml) becuase it is a simple format so that user can edit file manually and file can be easily parsed by a program. XML with xsd schema was also an option but it is too verbose for baremetal editors (e.g vim)

#### Electron
Making a desktop application is not an easy task. Furthermore making it cross-platform is even harder. There are several options to make cross plastform desktop application in which I believe electron is the easiest of them. There are good amount of documentations for developing a desktop app and also rich stackoverflow answers for javascript.

## Basic Usage
*WIP*

## TODO 

- [ ] Command line options e.g init, new file
	- [x] Validation
	- [x] Headless Reference Check
	- [x] Init config file
	- [x] Create new gdml file
	- [ ] Show list of gdml files in root directory
- [x] Config file 
	- [x] Exclusion rules
	- [x] Font size
	- [x] Start Mode
	- [x] Check dependencies on save
- [x] Editable config window
- [x] Template Support
- [ ] Resizable left panel
- [ ] Search text in editor
- [ ] Single executable file
- [ ] Improve Aesthetics
