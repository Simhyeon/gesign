# Gesign
Game design document editor

## Abstract
Gesign is composed of two parts. Gesign editor and gdml format.

Gesign editor is an electron application that enables easy editing of gdml file. Gesign is made of pure javascript and several modules including [ToastUIEditor](https://github.com/nhn/tui.editor). Editor reads files from given directory and check if references(dependencies) are all resovled or not. It is easily distinguishable by color so that user can identify which documents are outdatd or up-to-date, and also check referring document's status. 

Gdml format is just a yaml file with predefined tags. Gdml format consists of meta information and markdown content as a body.

## Gdml specification
- **status** : either OUTDATED or UPTODATE
- **reference** : array(list) of directories
- **comment_by** : last comment 
- **body** : document written in format of markdown(gfm).

#### e.g
```yaml
status: UPTODATE
reference: 
- path/to/target/file.gdml
- file/that/should/be/ref/checked.gdml
comment_by: Simon creek
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

- [X] Command line options e.g init, new file
- [ ] Single executable file
- [ ] Config file for exclusion rule
- [ ] Editable comment section.
- [ ] Git integration
