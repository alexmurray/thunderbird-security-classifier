var EXPORTED_SYMBOLS = [];

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("resource://security-classifier/common.js");

let hook = {
    /* support stable conversations */
    onMessageBeforeSend: function (aAddress, aEditor, aStatus) {
	if (!aAddress.params) {
	    try {
		/* hack to get params since they're not passed in
		 * onMessageBeforeSend -
		 * https://github.com/protz/GMail-Conversation-View/pull/547#issuecomment-3561102 */
		let w = Cc["@mozilla.org/appshell/window-mediator;1"]
		    .getService(Ci.nsIWindowMediator)
		    .getMostRecentWindow("mail:3pane")
		let tabmail = w.document.getElementById("tabmail");
		let contentWindow = (tabmail.currentTabInfo.mode.type != "chromeTab" ?
				     w.document.getElementById("multimessage").contentWindow :
				     tabmail.currentTabInfo.browser.contentWindow);
		aAddress.params = contentWindow.gComposeSession.params;
	    } catch (e) {
		debug("Error doing hack for params: " + e);
	    }
	}
	return this.onMessageBeforeSendOrPopout_early(aAddress, aEditor, aStatus, false);
    },
    /* support master conversations - get early*/
    onMessageBeforeSendOrPopout_early: function (aAddress, aEditor, aStatus, aPopout) {
	if (!aPopout && !aStatus.canceled) {
	    let params = aAddress.params;
	    var classification;

	    classification = extractClassification(params.subject);

	    /* ask for a classification if not already classified */
	    if (!classification.security) {
		classification = askForClassification(null);
		if (classification.security) {
		    params.subject = classifySubject(params.subject,
						     classification.security,
						     classification.privacy);
		}
	    }
	    if (classification.security) {
		var ret = tryWarnOnExternalClassified(null,
						      classification.security,
						      [].concat(aAddress.to,
								aAddress.cc,
								aAddress.bcc));

		if (ret) {
		    /* set classification in message body too */
		    var marking = classification.security;
		    if (classification.privacy) {
			marking += ":" + classification.privacy;
		    }
		    /* USE * to highlight since is plain text */
		    aEditor.value = "*" + marking + "*\n\n" + aEditor.value;

		    /* add to otherRandomHeaders in params to set
		       X-Protective-Marking header as per Email Protective
		       Marking Standard for the Australian Government
		       October 2005 -
		       http://www.finance.gov.au/e-government/security-and-authentication/docs/Email_Protective.pdf */
		    params.otherRandomHeaders = ((params.otherRandomHeaders ?
						  params.otherRandomHeaders : "") +
						 "X-Protective-Marking: VER=2005.6, NS=gov.au, SEC=" +
						 marking + ", ORIGIN=" + params.identity.email + "\n");
		} else {
		    aStatus.canceled = true;
		}
	    } else {
		aStatus.canceled = true;
	    }
	}
	return aStatus;
    },
}

try {
    Cu.import("resource://conversations/hook.js");
    registerHook(hook);
} catch (e) {
    /* catch exception so we don't pollute error console when
     * conversations isn't installed */
}
