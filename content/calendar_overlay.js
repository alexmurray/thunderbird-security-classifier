Components.utils.import("resource://security-classifier/common.js");

function updateTitle() {
    var dialog = document.getElementById("calendar-event-dialog");
    var itemTitle = document.getElementById("item-title");
    var title = itemTitle.value;

    title = classifySubject(title, dialog._security, dialog._privacy);

    if (title != itemTitle.value) {
	debug("setting title: " + title);
	itemTitle.value = title;
    }
    return title;
}

/* override original save command in lightning so we can intercept to
 * ask for classification */
var origonCommandSave = onCommandSave;

onCommandSave = function (aIsClosing) {
    debug("onCommandSave: aIsClosing: " + aIsClosing);
    if (aIsClosing) {
	var dialog = document.getElementById("calendar-event-dialog");
	var classification = { security: dialog._security,
			       privacy: dialog._privacy };

	if (!classification.security) {
	    debug("onCommandSave: asking for classification");
	    classification = askForClassification(window);
	    dialog._security = classification.security;
	    dialog._privacy = classification.privacy;
	}
	debug("onCommandSave: updating title");
	updateTitle();

	if (classification.security) {
	    debug("calling origonCommandSave");
	    return origonCommandSave(aIsClosing);
	}
    } else {
	debug("calling origonCommandSave");
	return origonCommandSave(aIsClosing);
    }
}

function setSecurity (security) {
    var dialog = document.getElementById("calendar-event-dialog");
    // update our copy
    dialog._security = security;
    debug("setSecurity: " + security);
    updateTitle();

    var privacyList = document.getElementById("privacy-list");
    /* clear privacy list if no security selected */
    if (!security) {
	privacyList.selectedIndex = 0;
	setPrivacy(null);
    }
    privacyList.disabled = (security == null);
}

function setPrivacy (privacy) {
    var dialog = document.getElementById("calendar-event-dialog");
    // update our copy
    dialog._privacy = privacy;
    debug("setPrivacy: " + privacy);
    updateTitle();
}

function titleChanged() {
    var dialog = document.getElementById("calendar-event-dialog");

    debug("title changed");

    if (!dialog._security) {
	// extract any existing security + privacy classification
	var title = document.getElementById("item-title").value;

	classification = extractClassification(title);
	debug("trying to extract classification from title: " + title);
	/* indexOf returns -1 if not found, and starts at 0 if found,
	 * but our list has 0 as empty element so incrementing for all
	 * cases is fine */
	var i = getSecurityMarkings().indexOf(classification.security) + 1;
	/* is a valid security marker */
	document.getElementById("security-list").selectedIndex = i;
	if (i >= 0) {
	    setSecurity(classification.security);
	} else {
	    setSecurity(null);
	}
	/* indexOf returns -1 if not found, and starts at 0 if found,
	 * but our list has 0 as empty element so incrementing for all
	 * cases is fine */
	i = getPrivacyMarkings().indexOf(classification.privacy) + 1;
	/* is a valid privacy marker */
	document.getElementById("privacy-list").selectedIndex = i;
	if (i >= 0) {
	    setPrivacy(classification.privacy);
	} else{
	    setPrivacy(null);
	}
    }
    debug("updating title");
    updateTitle();
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

function initDialog() {
    var securityList = document.getElementById("security-list");
    var privacyList = document.getElementById("privacy-list");

    setupLists(securityList, privacyList);
    /* disable privacyList until a security marking is selected */
    privacyList.disabled = true;

    // watch for manual changes to title to enforce our
    // classification
    var itemTitle = document.getElementById("item-title");
    itemTitle.addEventListener("change", titleChanged, true);
}

window.addEventListener("load", initDialog, true);
