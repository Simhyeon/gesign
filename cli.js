'use strict;'
let args = new Array();

module.exports = {
	CliOption : class CliOption {
		constructor(shortOp, longOP, action, actionArg) {
			this.shortOp = shortOp;
			this.longOp = longOP;
			this.action = action;
			this.actionArg = actionArg;
		}
	},

	// key : option string, value: argument
	args : new Array(),
	init : function(newArgs) {
		args = newArgs;
	},
	hasFlag : function(option) {
		let result = false;
		args.forEach((item) => {
			if (item === option.shortOp || item === option.longOp) {
				result = true;
			}
		});

		return result;
	},
	execFlagAction : function(option) {
		if (this.hasFlag(option)) {
			if (option.actionArg !== null) {
				option.action(option.actionArg);
			} else {
				option.action();
			}
			return true;
		} else {
			return false;
		}
	},
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
