## Gesign
Game design document editor

### Abstract
Gesign is composed of two parts. Gesign editor and gdml format.

Gesign editor is an electron application that enables easy editing of gdml file. Gesign is made of pure javascript and several modules including [ToastUIEditor](https://github.com/nhn/tui.editor). Editor reads files from given directory and check if references(dependencies) are all resovled or not. It is easily distinguishable by color so that user can identify which documents are outdatd or up-to-date, and also check referring document's status. 

Gdml format is just a yaml file with specific tags. Gdml format consists of meta information and markdown content as a body.

### Gdml specipication
- **status** : one of UNSAVED, SAVED
- **reference** : array(list) of directories
- **comment_by** : last comment 
- **body** : document written in format of markdown(gfm).

### Why gdml?

#### Mindset behind gdml
Game design documents get deprecated very fast and it is hard to make documents up to date. To fix this problem, I thought making documents modular and able to reference each other is necessary.

#### Technical reasoning

##### yaml
I chose to use yaml(gdml) becuase it is a simple format so that user can edit gdml file manually and also easily parsed by program.

### Why Electron?
Making a desktop application is not an easy task. Furthermore making it cross-platform is even harder. There are several options to make cross plastform desktop application, however I chose electron because there were sufficient documentations for developing desktop apps and also rich stackoverflow answers for javascript and nodejs.

###

### TODO 

- [X] Command line options e.g init, new file
- [ ] Single executable file
- [ ] Config file for exclusion rule
- [ ] Editable comment section.
- [ ] Git integration
