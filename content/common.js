var EXPORTED_SYMBOLS = ["debug", "extractClassification", "classifySubject",
			"askForClassification", "setupLists",
			"tryWarnOnExternalClassified"];

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("resource://security-classifier/common.js");
Cu.import("resource://security-classifier/prefs.js");

function debug(msg) {
    if (Prefs["logging-enabled"]){
	Cc["@mozilla.org/consoleservice;1"]
            .getService(Ci.nsIConsoleService)
	    .logStringMessage("tb-security-classifier: " + msg);
    }
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
	parent = Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(Ci.nsIWindowMediator)
            .getMostRecentWindow("mail:3pane")
    }
    /* use window-watcher to open window */
    Cc["@mozilla.org/embedcomp/window-watcher;1"]
        .getService(Ci.nsIWindowWatcher)
	.openWindow(parent,
		    "chrome://security-classifier/content/classification_dialog.xul",
		    "_blank", "chrome,dialog,modal,resizeable=yes", classification);
    return classification;
}


function setupLists(securityList, privacyList) {
    securityList.removeAllItems();
    /* add an empty one so user can deselect current value */
    securityList.appendItem("");
    for (let [i, security] in Iterator(Prefs["security-markings"])) {
	securityList.appendItem(security);
    }
    securityList.selectedIndex = 0;
    privacyList.removeAllItems();
    privacyList.appendItem("");
    for (let [i, privacy] in Iterator(Prefs["privacy-markings"])) {
	privacyList.appendItem(privacy);
    }
    privacyList.selectedIndex = 0;
}

function tryWarnOnExternalClassified(window,
				     classification,
				     recipients) {
    var ret = true;

    /* see if want to warn on sending classified email to
     * external recipients if this is not unclassified -
     * assume unclassified is the first element in
     * security-markings */
    debug("Message is classified: " + classification +
	  "[" + Prefs["security-markings"].indexOf(classification) +
	  "]");
    if (Prefs["warn-external-classified"] &&
	Prefs["security-markings"].indexOf(classification) > 0) {
	debug("Checking for external recipients: " + recipients);
	/* recipients is an array of email addresses */
	for each (recipient in recipients) {
	    /* if we can't find internal-domain somewhere in the email
	     * address assume is external */
	    if (!(recipient.match(Prefs["internal-domain"]))) {
		if (!window) {
		    /* get main window if none supplied */
		    window = Cc["@mozilla.org/appshell/window-mediator;1"]
			.getService(Ci.nsIWindowMediator)
			.getMostRecentWindow("mail:3pane")
		}
		ret = Cc["@mozilla.org/embedcomp/prompt-service;1"]
		    .getService(Ci.nsIPromptService)
		    .confirm(window,
			     "External recipients for classified email",
			     "This " + classification + " classified " +
			     "email is addressed to external recipients " +
			     "(outside of the " + Prefs["internal-domain"] +
			     " " + "domain) - " +
			     "are you sure you want to do this?");
		if (!ret) {
		    debug("tryWarnOnExternalClassified: User selected to cancel send");
		    return ret;
		}
	    }
	}
    }
    return ret;
}
