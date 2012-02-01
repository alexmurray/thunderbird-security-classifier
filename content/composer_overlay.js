const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("resource://security-classifier/common.js");
Cu.import("resource://security-classifier/prefs.js");

function range(begin, end) {
    for (let i = begin; i < end; ++i) {
	yield i;
    }
}

function extractAddresses(line) {
    let emails = {};
    let fullNames = {};
    let names = {};
    let numAddresses = Cc["@mozilla.org/messenger/headerparser;1"]
	.getService(Ci.nsIMsgHeaderParser)
	.parseHeadersWithArray(line, emails, names, fullNames);
    if (numAddresses)
	return [emails.value[i] for each (i in range(0, numAddresses))];
    else
	return [];
}

function classifyOutgoingMessage() {
    var msgcomposeWindow = document.getElementById("msgcomposeWindow");
    var msg_type = msgcomposeWindow.getAttribute("msgtype");

    debug("classifyOutgoingMessage");
    /* only classify when this is an actual send event since we
       sometimes get save events etc which we don't want to classify
       on */
    if (msg_type == nsIMsgCompDeliverMode.Now ||
	msg_type == nsIMsgCompDeliverMode.Later) {
	debug("classifyOutgoingMessage: classifying...");
	var classification = { security: msgcomposeWindow._security,
			       privacy: msgcomposeWindow._privacy };

	if (!classification.security) {
	    classification = askForClassification(window);
	    msgcomposeWindow._security = classification.security;
	    msgcomposeWindow._privacy = classification.privacy;
	}

	/* set subject in gMsgCompose from returned subject in
	 * updating widgets */
	gMsgCompose.compFields.subject = updateSubject();

	debug("classifyOutgoingMessage: classification: " + classification.security);
	if (classification.security) {
	    var ret = tryWarnOnExternalClassified(window,
						  classification.security,
						  [].concat(extractAddresses(gMsgCompose.compFields.to),
							    extractAddresses(gMsgCompose.compFields.cc),
							    extractAddresses(gMsgCompose.compFields.bcc)));
	    if (!ret) {
		return false;
	    }
	    /* set X-Protective-Marking header as per Email Protective Marking
	       Standard for the Australian Government October 2005 -
	       http://www.finance.gov.au/e-government/security-and-authentication/docs/Email_Protective.pdf */
	    var marking = msgcomposeWindow._security;
	    if (msgcomposeWindow._privacy) {
		marking += ':' + msgcomposeWindow._privacy;
	    }
	    gMsgCompose.compFields.otherRandomHeaders += "X-Protective-Marking: VER=2005.6, NS=gov.au, SEC=" +
		marking + ", ORIGIN=" + gMsgCompose.identity.email + "\n";

	    /* set the classification in the message body */
	    var editor = GetCurrentEditor();
	    var editor_type = GetCurrentEditorType();
	    editor.beginTransaction();
	    editor.beginningOfDocument(); // seek to beginning
	    if (editor_type == "textmail" || editor_type == "text") {
		editor.insertText(marking);
		editor.insertLineBreak();
		editor.insertLineBreak();
	    } else {
		editor.insertHTML("<p><b>" + marking + "</b></p>");
	    }
	    editor.endTransaction();
	}
	return (classification.security ? true : false);
    }
    return true;
}

function composeSendMessageEventHandler(event) {
    /* try and classify - if that succeeds then set headers and
     * send */
    try {
	var ret = classifyOutgoingMessage();
	if (!ret) {
	    /* stop sending */
	    event.preventDefault();
	}
    } catch (e) {
	debug("ERROR: " + e);
	event.preventDefault();
    }
}

window.addEventListener("compose-send-message", composeSendMessageEventHandler, true);

function updateSubject () {
    var msgcomposeWindow = document.getElementById("msgcomposeWindow");
    var msgSubject = document.getElementById("msgSubject");
    var subject = msgSubject.value;

    subject = classifySubject(subject, msgcomposeWindow._security, msgcomposeWindow._privacy);

    if (subject != msgSubject.value) {
	debug("setting subject: " + subject);
	msgSubject.value = subject;
    }
    return subject;
}


function setSecurity (security) {
    var msgcomposeWindow = document.getElementById("msgcomposeWindow");
    // update our copy
    msgcomposeWindow._security = security;
    debug("setSecurity: " + security);
    updateSubject();

    var privacyList = document.getElementById("privacy-list");
    /* clear privacy list if no security selected */
    if (!msgcomposeWindow._security) {
	privacyList.selectedIndex = 0;
	setPrivacy(null);
    }
    privacyList.disabled = (security == null);
}

function setPrivacy (privacy) {
    var msgcomposeWindow = document.getElementById("msgcomposeWindow");
    // update our copy
    msgcomposeWindow._privacy = privacy;
    debug("setPrivacy: " + privacy);
    updateSubject();
}

function subjectChanged() {
    var msgcomposeWindow = document.getElementById("msgcomposeWindow");

    debug("subject changed");

    if (!msgcomposeWindow._security) {
	// extract any existing security + privacy classification
	var subject = document.getElementById("msgSubject").value;

	classification = extractClassification(subject);
	debug("trying to extract classification from subject: " + subject);
	/* indexOf returns -1 if not found, and starts at 0 if found,
	 * but our list has 0 as empty element so incrementing for all
	 * cases is fine */
	var i = Prefs["security-markings"].indexOf(classification.security) + 1;
	debug("selecting security-list index " + i);
	document.getElementById("security-list").selectedIndex = i;
	if (i >= 0) {
	    setSecurity(classification.security);
	} else {
	    setSecurity(null);
	}
	/* indexOf returns -1 if not found, and starts at 0 if found,
	 * but our list has 0 as empty element so incrementing for all
	 * cases is fine */
	i = Prefs["privacy-markings"].indexOf(classification.privacy) + 1;
	debug("selecting privacy-list index " + i);
	document.getElementById("privacy-list").selectedIndex = i;
	if (i >= 0) {
	    setPrivacy(classification.privacy);
	} else{
	    setPrivacy(null);
	}
    }
    debug("updating subject");
    updateSubject();
    return true;
}

function onSecurityListCommand (){
    var securityList = document.getElementById("security-list");
    // set the classification
    var security = securityList.selectedItem.label;
    debug("Selected security: " + security);
    setSecurity(security != "" ? security : null);
}

function onPrivacyListCommand (){
    var privacyList = document.getElementById("privacy-list");
    // set the classification
    var privacy = privacyList.selectedItem.label;
    debug("Selected privacy: " + privacy);
    setPrivacy(privacy != "" ? privacy : null);
}

// set up
var composeStateListener = {
    init: function(e){
	gMsgCompose.RegisterStateListener(composeStateListener);
    },
    NotifyComposeFieldsReady: function() {
	// fill in our security and privacy menulists
	var securityList = document.getElementById("security-list");
	var privacyList = document.getElementById("privacy-list");
	setupLists(securityList, privacyList);
	/* disable privacyList until a security marking is selected */
	privacyList.disabled = true;
	/* ensure no security / privacy markings are hanging around
	 * from previous instantiations of the compose window */
	var msgcomposeWindow = document.getElementById("msgcomposeWindow");
	msgcomposeWindow._security = null;
	msgcomposeWindow._privacy = null;

	/* try and extract a classification from the subject */
	subjectChanged();

	// watch for manual changes to subject to enforce our
	// classification
	var msgSubject = document.getElementById("msgSubject");
	msgSubject.addEventListener("change", subjectChanged, true);
    },
    NotifyComposeBodyReady: function() {
    },
    ComposeProcessDone: function(aResult) {
    },
    SaveInFolderDone: function(folderURI) {
    }
};

window.addEventListener("compose-window-init", composeStateListener.init, true);
