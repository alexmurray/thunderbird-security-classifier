var EXPORTED_SYMBOLS = ["Prefs"]

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;
const Cr = Components.results;

const prefsService = Cc["@mozilla.org/preferences-service;1"]
  .getService(Ci.nsIPrefService)
  .getBranch("extensions.security-classifier.");
const gPrefBranch = Cc["@mozilla.org/preferences-service;1"]
  .getService(Ci.nsIPrefService)
  .getBranch(null);

function PrefManager() {
    this["logging-enabled"] = prefsService.getBoolPref("logging-enabled");
    this["security-markings"] = [];
    for each (s in this.split(prefsService.getCharPref("security-markings")))
	this["security-markings"].push(s);

    this["privacy-markings"] = [];
    for each (s in this.split(prefsService.getCharPref("privacy-markings")))
	this["privacy-markings"].push(s);

    this.watchers = [];

    this.register();
}

PrefManager.prototype = {

    split: function (s) Array.map(s.split(","), String.trim).filter(String.trim),

    watch: function (watcher) this.watchers.push(watcher),

    register: function mpo_register (observer) {
	prefsService.QueryInterface(Ci.nsIPrefBranch2);
	if (observer)
	    prefsService.addObserver("", observer, false);
	else
	    prefsService.addObserver("", this, false);
    },

    unregister: function mpo_unregister () {
	if (!prefsService)
	    return;
	prefsService.removeObserver("", this);
    },

    observe: function mpo_observe (aSubject, aTopic, aData) {
	if (aTopic != "nsPref:changed")
	    return;

	switch (aData) {
	case "logging-enabled": {
            let v = prefsService.getBoolPref(aData);
            this[aData] = v;
            [x(aData, v) for each (x in this.watchers)];
            break;
	}

	case "security-markings":
	case "privacy-markings":
            this[aData] = [];
            for each (s in this.split(prefsService.getCharPref(aData)))
		this[aData].push(s);
            break;
	}
    },

    getChar: function (p) {
	return gPrefBranch.getCharPref(p);
    },

    getBool: function (p) {
	return gPrefBranch.getBoolPref(p);
    },

    setChar: function (p, v) {
	return gPrefBranch.setCharPref(p, v);
    },

    setBool: function (p, v) {
	return gPrefBranch.setBoolPref(p, v);
    },
}

// Prefs is a singleton.
let Prefs = new PrefManager();
