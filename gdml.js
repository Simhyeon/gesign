module.exports = {
	newGdml: function() {
		return {
			status: "UPTODATE", 
			//TODO SHOULD SET TIMESTAMPE
			lastModified : Date.now(),
			reference: new Array(),
			body: ""
		}
	}
}
