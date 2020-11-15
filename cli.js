'use strict;'
let args = new Array();

module.exports = {
	// Class ::: Cli option class that contains informations need to parse process arguments and apply corresponding closure, function.
	CliOption : class CliOption {
		constructor(shortOp, longOP, action, actionArg) {
			this.shortOp = shortOp;
			this.longOp = longOP;
			this.action = action;
			this.actionArg = actionArg;
		}
	},

	// VARIABLE ::: Local varaible saving process.args();
	args : new Array(),
	// FUNCTION ::: initiate local args variable with given argument;
	init : function(newArgs) {
		args = newArgs;
	},
	// FUNCTION ::: Check if local args contains given option's value
	hasFlag : function(option) {
		let result = false;
		args.forEach((item) => {
			if (item === option.shortOp || item === option.longOp) {
				result = true;
			}
		});

		return result;
	},
	// FUNCTION ::: Execute corresponding function to given option
	execFlagAction : function(option) {
		if (this.hasFlag(option)) {
			if (option.actionArg !== null) {
				return option.action(option.actionArg);
			} else {
				return option.action();
			}
		} else {
			return null;
		}
	},
	// FUNCTION ::: Get flag's direct argument. 
	// e.g in '--dir <directoryName>' directoryName is the argument.
	getFlagArgIndex : function(option) {
		for (let i = 0; i < args.length; i++) {
			let item = args[i];
			if (item === option.shortOp || item === option.longOp) {
				if ( i !== args.length -1 ) {
					return i+1;
				}
			}
		}
		return null;
	}
}
