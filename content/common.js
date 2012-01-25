var EXPORTED_SYMBOLS = ["getSecurityMarkings", "getPrivacyMarkings",
			"debug", "subjectIsClassified",
			"extractClassification",
			"classifySubject", "askForClassification",
			"setupLists"];

function debug(msg) {
    if (Components.classes["@mozilla.org/preferences-service;1"]
	.getService(Components.interfaces.nsIPrefService)
	.getBranch("extensions.security-classifier.").getBoolPref("debug")){
	Components.classes["@mozilla.org/consoleservice;1"]
            .getService(Components.interfaces.nsIConsoleService)
	    .logStringMessage("tb-security-classifier: " + msg);
    }
}

function getSecurityMarkings() {
    return Array.map(Components.classes["@mozilla.org/preferences-service;1"]
		     .getService(Components.interfaces.nsIPrefService)
		     .getBranch("extensions.security-classifier.").getCharPref("security-markings").split(","), String.trim).filter(String.trim);
}

function getPrivacyMarkings() {
    return Array.map(Components.classes["@mozilla.org/preferences-service;1"]
		     .getService(Components.interfaces.nsIPrefService)
		     .getBranch("extensions.security-classifier.").getCharPref("privacy-markings").split(","), String.trim).filter(String.trim);
}

// checks subject is classified
function subjectIsClassified(subject) {
    // check subject contains ' [SEC=XXX]' at end
    var re = / \[SEC=[A-Z-]+:?([A-Z]+)?\]/;
    return subject.match(re);
}

function stripClassification (subject) {
    return subject.replace(/\[SEC=[A-Z-]+:?([A-Z]+)?\]/, '');
}

function extractClassification(subject) {
    var re = /\[SEC=([A-Z-]+):?([A-Z]+)?\]/g;
    var matches = re.exec(subject);
    var classification = { security: null,
			   privacy: null };

    /* get final match */
    while (matches != null){
	classification.security = matches[1];
	if (matches.length == 3) {
	    classification.privacy = matches[2];
	}
	matches = re.exec(subject);
    }
    return classification;
}

function classifySubject(subject, security, privacy) {
    subject = stripClassification(subject);
    if (security) {
	/* append a space if doesn't end with one */
	if (subject.charAt(subject.length - 1) != ' '){
	    subject += ' ';
	}
	subject += '[SEC=' + security;
	if (privacy) {
	    subject += ':' + privacy;
	}
	subject += ']';
    }
    return subject;
}

function askForClassification(parent) {
    var classification = { security: null, privacy: null };
    /* wrap so can pass via openWindow */
    classification.wrappedJSObject = classification;

    if (!parent) {
	/* get main window if none supplied */
	parent = Components.classes["@mozilla.org/appshell/window-mediator;1"]
            .getService(Components.interfaces.nsIWindowMediator)
            .getMostRecentWindow("mail:3pane")
    }
    /* use window-watcher to open window */
    Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
        .getService(Components.interfaces.nsIWindowWatcher)
	.openWindow(parent,
		    "chrome://security-classifier/content/classification_dialog.xul",
		    "_blank", "chrome,dialog,modal,resizeable=yes", classification);
    return classification;
}


function setupLists(securityList, privacyList) {
    securityList.removeAllItems();
    /* add an empty one so user can deselect current value */
    securityList.appendItem("");
    for (let [i, security] in Iterator(getSecurityMarkings())) {
	securityList.appendItem(security);
    }
    securityList.selectedIndex = 0;
    privacyList.removeAllItems();
    privacyList.appendItem("");
    for (let [i, privacy] in Iterator(getPrivacyMarkings())) {
	privacyList.appendItem(privacy);
    }
    privacyList.selectedIndex = 0;
}
