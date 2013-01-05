
// This is an extension of the notificationlist.htc file
// Properties Already Defined: Visible, HasErrors
// Functions Already Defined: AddNotification, GetNotifications, GetSeverityEnum

// --Credits--
// Thanks to Isaac Sultan for discovering this
// http://crm2011wiki.wordpress.com/2012/04/16/showing-custom-alerts-in-notifications-area/

/*jslint browser: true, nomen: true, sloppy:true, plusplus:true */
/*global JCL */

if (typeof JCL === 'undefined') {
    var JCL = {};
}

JCL._Notifications = document.getElementById('crmNotifications');
JCL._Notifications.HiddenIDs = []; // work around due to lack of public methods

JCL.ArrayContains = function (a, obj) {
    var i = a.length;
    while (i--) {
        if (a[i] === obj) {
            return true;
        }
    }
    return false;
};

JCL.HasErrorsInNotifications = function () {
    return JCL._Notifications.HasErrors;
};

JCL.GetNotifications = function () {
    return JCL._Notifications.GetNotifications();
};

JCL.AddNotification = function (notificationID, typeOfMessage, source, message) {
    // 1 = Critical
    // 2 = Warning
    // 3 = Info
    var i = 0,
        added = false;

    added = JCL._Notifications.AddNotification(notificationID, typeOfMessage, source, message);

    if (added) {
        for (i = 0; i < JCL._Notifications.HiddenIDs.length; i++) {
            JCL.ClearNotification(JCL._Notifications.HiddenIDs[i]);
        }
    }
};

JCL.ClearNotifications = function () {
    JCL._Notifications.SetNotifications(null, null);
    JCL._Notifications.HiddenIDs = []; // clear list    
};

JCL.ClearNotification = function (notificationID) {
    var i = 0,
        notifications = JCL._Notifications.GetNotifications(),
        hiddenCount = 0;

    for (i = 0; i < notifications.length; i++) {
        if (notifications[i].Id === notificationID) {
            //frames[0].document.getElementById('Notification' + (notifications[i].Order--)).style.display = 'none';
            JCL._Notifications.children[i].style.display = 'none';

            if (!JCL.ArrayContains(JCL._Notifications.HiddenIDs, notificationID)) {
                JCL._Notifications.HiddenIDs.push(notificationID);
            }
        }
    }

    for (i = 0; i < JCL._Notifications.children.length; i++) {
        if (JCL._Notifications.children[i].style.display === 'none') {
            hiddenCount++;
        }
    }

    if (hiddenCount === JCL._Notifications.children.length) {
        JCL.ClearNotifications();
    }
};

