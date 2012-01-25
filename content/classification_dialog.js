Components.utils.import("resource://security-classifier/common.js");

function onLoad() {
    setupLists(document.getElementById("security-list"),
	       document.getElementById("privacy-list"));
}

function onAccept() {
    var retval = window.arguments[0];
    /* if came from windowWatcher we use wrappedJSObject to pass
     * retval */
    if (retval.wrappedJSObject) {
	retval = retval.wrappedJSObject;
    }
    var securityList = document.getElementById("security-list");
    if (securityList.selectedItem) {
	retval.security = (securityList.selectedItem.label != "" ?
			   securityList.selectedItem.label : null);
	var privacyList = document.getElementById("privacy-list");
	if (privacyList.selectedItem) {
	    retval.privacy = (privacyList.selectedItem.label != "" ?
			      privacyList.selectedItem.label : null);
	}
    }
    return (retval.security != null);
}
