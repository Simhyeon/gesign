module.exports = {
	// FUNCTION :: Create new gdml object
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
