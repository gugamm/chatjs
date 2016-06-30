/*
 CHAT LIBRARY
 Programmer : gugamm
 Date       : 30/06/2016

 Dependencies :
   - JQuery
   - Strophe Js

 Last Updates :
   - Add documentation
   - Chat is now Object Oriented (Is possible to create multiples chats)
   - Add support to dialogs (Is possible to create multiple dialogs)
*/

/* OBJECTS

    CHAT :
      _connected    : boolean
      _userJid      : string
      _userPassword : string
      serverHost    : string
      serverName    : string
      connection    : Strophe.Connection
      dialogs       : Array of Dialog
      DEBUG         : Object of DEBUG (OPTIONAL)

    DEBUG :
        no properties

    DIALOG :
      personJid    : jid (string)
      conversation : Array of DialogText

    CHAT MESSAGE :
      author : jid (string)
      text   : string
      date   : Date

 */

//ChatDebug constructor
function ChatDebug() {};

ChatDebug.prototype._printDebug = function (text) {
    console.log('[CHAT-DEBUG] : ' + text);
};

//Print string status in console
ChatDebug.prototype.printStatus = function (status) {
    switch(status) {
        case Strophe.Status.ERROR : this._printDebug("ERROR");
            break;
        case Strophe.Status.CONNECTING : this._printDebug("CONNECTING");
            break;
        case Strophe.Status.CONNFAIL : this._printDebug("CONNFAIL");
            break;
        case Strophe.Status.AUTHENTICATING : this._printDebug("AUTHENTICATING");
            break;
        case Strophe.Status.AUTHFAIL : this._printDebug("AUTHFAIL");
            break;
        case Strophe.Status.CONNECTED : this._printDebug("CONNECTED");
            break;
        case Strophe.Status.DISCONNECTED : this._printDebug("DISCONNECTED");
            break;
        case Strophe.Status.DISCONNECTING : this._printDebug("DISCONNECTING");
            break;
        case Strophe.Status.ATTACHED : this._printDebug("ATTACHED");
            break;
        case Strophe.Status.REDIRECT : this._printDebug("REDIRECT");
            break;
        case Strophe.Status.CONNTIMEOUT : this._printDebug("CONNTIMEOUT");
            break;
        default :
            this._printDebug(status);
    }
};

function ChatMessage(author, text, date) {
    this.author = author;
    this.text   = text;
    this.date   = date || new Date();
};

function ChatDialog(personJid) {
    this.personJid = personJid;
    this.conversation = [];
};

ChatDialog.prototype.addMessage        = function(author, text, date) {
    this.conversation.push(new ChatMessage(author, text, date));
};
ChatDialog.prototype.addReceivedMessage    = function(text, date) {
    this.conversation.push(new ChatMessage(this.personJid, text, date));
};
ChatDialog.prototype.clearConversation = function () {
    this.conversation.length = 0;
};

//Chat constructor
//serverHost : string
//serverName : string
//debug      : boolean (turn debug mode on or off)
//                      if debug mode is on, then there will be an object DEBUG in chat with helper debug functions
function Chat(serverHost, serverName, debug) {
    this.serverHost = serverHost;
    this.serverName = serverName;
    this.connection = null;
    this._connected = false;
    this._userJid      = null;
    this._userPassword = null;
    this.dialogs    = [];
    if (debug)
        this.DEBUG = new ChatDebug();
}

//private methods
Chat.prototype._updateConnectionStatus = function (state) {
    if (state === Strophe.Status.CONNECTED) {
        this._connected = true;
    } else if (state === Strophe.Status.DISCONNECTED) {
        this._connected = false;
    }
};
Chat.prototype._sendMessage            = function (destJid, message) {
    this.connection.send($msg({
        to : destJid,
        type : "chat"
    }).c('body').t(message));
};

//Private event handlers
Chat.prototype._handleStateChange    = function (state) {
    this._updateConnectionStatus(state);
    if (state === Strophe.Status.CONNECTED)
        this._handleConnectedEvent();

    if (!this.onStatusChange(state))
        return;

    if (state === Strophe.Status.CONNECTED) {
        this.onConnected();
    } else if (state === Strophe.Status.DISCONNECTED) {
        this.onDisconnected();
    } else if (state === Strophe.Status.AUTHFAIL) {
        this.onAuthFail();
    } else if (state === Strophe.Status.CONNFAIL) {
        this.onConnFail();
    } else if (state === Strophe.Status.ERROR) {
        this.onError();
    }
};
Chat.prototype._handleMessageEvent   = function (message) {
    var bareJid = Strophe.getBareJidFromJid($(message).attr('from'));
    var body    = $(message).find('body').text();

    var dialog = this.getDialog(bareJid);
    if (dialog) {
        dialog.addReceivedMessage(body, new Date());
    };

    this.onMessage(bareJid,body);
    return true;
};
Chat.prototype._handleConnectedEvent = function () {
    this.connection.addHandler(this._handleMessageEvent.bind(this), null, "message", "chat");
    this.connection.send($pres());
};

//Public event status handlers
//Override this to create a custom handler
//To get called on every event, override onStatusChange
//If onStatusChange returns true, then all others status handlers will be called normally
//If onStatusChange returns false, then it will assume that no others status handlers need to be called
Chat.prototype.onConnected    = function () {};
Chat.prototype.onDisconnected = function () {};
Chat.prototype.onAuthFail     = function () {};
Chat.prototype.onConnFail     = function () {};
Chat.prototype.onError        = function () {};
//status : Strophe.Status
Chat.prototype.onStatusChange = function (status) {
    return true;
};

//Public event message handler
//from    : complete jid
//message : content
Chat.prototype.onMessage      = function (from,message) {};

//Chat helper methods

//Connect to server and auth use provided credentials
Chat.prototype.connect        = function (jid, password) {
    this.connection = new Strophe.Connection("http://" + this.serverHost + ":7070/http-bind/");
    this.connection.connect(jid,password,this._handleStateChange.bind(this));
    this._userJid      = jid;
    this._userPassword = password;
};
//Disconnect from server and set connection property to null
Chat.prototype.disconnect     = function () {
    if (this.connection) {
        this.connection.disconnect();
        this.connection = null;
        this._userJid = null;
        this._userPassword = null;
    }
};
//Return true if connected. False if not connected
Chat.prototype.isConnected    = function () {
    return this._connected;
};
//Return a bareJid containing only the node + serverName like : node@serverName
Chat.prototype.buildJid       = function (node) {
    return node + "@" + this.serverName;
};


//Chat dialog functions
Chat.prototype.addDialog      = function (dialogObj) {
    this.dialogs.push(dialogObj);
};

Chat.prototype.getDialogId    = function (personJid) {
    for (var i = 0; i < this.dialogs.length; i++) {
        if (this.dialogs[i].personJid === personJid) {
            return i;
        };
    }
    return -1;
};
Chat.prototype.getDialog      = function (personJid) {
    var dialogId = this.getDialogId(personJid);
    if (dialogId !== -1)
        return this.dialogs[dialogId];
    return null;
};

Chat.prototype.createDialogIfNotExists             = function (personJid) {
    var dialogId = this.getDialogId(personJid);

    if (dialogId !== -1)
        return this.dialogs[dialogId];

    var dialog = new ChatDialog(personJid);
    this.dialogs.push(dialog);

    return dialog;
};
Chat.prototype.createDialog                        = function (personJid) {
    var dialog = new ChatDialog(personJid);
    this.dialogs.push(dialog);
    return dialog;
};
Chat.prototype.createDialogsIfNotExistsByHostsJids = function (hostsJids) {
    var hostJid;
    var dialogs = [];
    for (var i = 0; i < hostsJids.length; i++) {
        hostJid = hostsJids[i];
        dialogs.push(this.createDialogIfNotExists(hostJid));
    }
    return dialogs;
};
Chat.prototype.createDialogsByHostsJid             = function (hostsJids) {
    var hostJid;
    var dialogs = [];
    for (var i = 0; i < hostsJids.length; i++) {
        hostJid = hostsJids[i];
        dialogs.push(this.createDialog(hostJid));
    }
    return dialogs;
};
Chat.prototype.createDialogsIfNotExistsByHostNodes = function (hostsNodes) {
    var hostJid;
    var dialogs = [];
    for (var i = 0; i < hostsNodes.length; i++) {
        hostJid = this.buildJid(hostsNodes[i]);
        dialogs.push(this.createDialogIfNotExists(hostJid));
    }
    return dialogs;
};
Chat.prototype.createDialogsByHostsNodes           = function (hostsNodes) {
    var hostJid;
    var dialogs = [];
    for (var i = 0; i < hostsNodes.length; i++) {
        hostJid = this.buildJid(hostsNodes[i]);
        dialogs.push(this.createDialog(hostJid));
    }
    return dialogs;
};

Chat.prototype.deleteDialog = function (personJid) {
    var dialogId = this.getDialogId(personJid);
    if (dialogId !== -1)
        this.dialogs.splice(dialogId,1);
};
Chat.prototype.clearDialogs = function () {
    this.dialogs.length = 0;
};

Chat.prototype.sendMessage      = function (destJid, message) {
    if (!this._connected)
        return false;

    var dialog = this.getDialog(destJid);
    if (dialog)
        dialog.addMessage(this._userJid, message, new Date());

    this._sendMessage(destJid, message);
    return true;
};
Chat.prototype.broadcastMessage = function (message) {
    if (!this._connected)
        return false;

    var dialog;
    var destJid;
    for (var i = 0; i < this.dialogs.length; i++) {
        dialog  = this.dialogs[i];
        destJid = dialog.personJid;
        dialog.addMessage(this._userJid, message, new Date());
        this._sendMessage(destJid, message);
    }

    return true;
};