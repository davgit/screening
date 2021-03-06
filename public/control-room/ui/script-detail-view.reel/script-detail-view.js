/* <copyright>
Copyright (c) 2012, Motorola Mobility LLC.
All Rights Reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice,
  this list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of Motorola Mobility LLC nor the names of its
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
</copyright> */
var Montage = require("montage/core/core").Montage,
    Component = require("montage/ui/component").Component,
    PreferenceManager = require("control-room/preference-manager").PreferenceManager,
    Confirm = require("montage/ui/popup/confirm.reel").Confirm,
    Popup = require ("montage/ui/popup/popup.reel").Popup,
    Alert = require ("montage/ui/popup/alert.reel").Alert;

exports.ScriptDetailView = Montage.create(Component, {
    selectedAgent: {
        value: null
    },

    activeAgents: {
        value: null
    },

    _recordingAgent: {
        value: null
    },

    _recordingPaused: {
        value: false
    },

    pauseRecordButton: {
        value: null,
        serializable: true
    },

    recordButton: {
        value: null,
        serializable: true
    },

    runButton: {
        value: null,
        serializable: true
    },

    saveButton: {
        value: null,
        serializable: true
    },

    deleteButton: {
        value: null,
        serializable: true
    },

    downloadButton: {
        value: null,
        serializable: true
    },

    urlPrompt: {
        value: null,
        serializable: true
    },

    _createNewScript: {
        enumerable: false,
        value: false
    },

    lastTestResult: {
        value: null
    },

    serverVersion: {
        value: null
    },

    createNewScript: {
        get: function() {
            return this._createNewScript;
        },
        set: function(value) {
            this._createNewScript = value;
        }
    },

    _scriptSource: {
        enumerable: false,
        value: null
    },

    scriptSource: {
        get: function() {
            return this._scriptSource;
        },
        set: function(value) {
            if (value) {
                if (!value) {
                    this._scriptSource = null;
                    return;
                }

                if (value !== this.scriptSource) {
                    this._scriptSource = value;
                    if (this._codeMirror) {
                        // This is a hack to get things working with Code Mirror which doesn't like empty code
                        if (this.scriptSource.code == "") {
                            this.scriptSource.code = "   ";
                        }

                        this._codeMirror.setValue(this.scriptSource.code);
                        this.needsSave = false;
                    }
                }

            }
        }
    },

    _scriptCode: {
        enumerable:false,
        value: null
    },

    scriptCode: {
        get: function() {
            return this._scriptCode;
        },
        set: function(value) {
            this._scriptCode = value;
        },
        serializable: true
    },

    _scriptNameField: {
        enumerable:false,
        value:null
    },

    scriptNameField: {
        get: function() {
            return this._scriptNameField;
        },
        set: function(value) {
            this._scriptNameField = value;
        },
        serializable: true
    },

    scriptTags: {
        value: null,
        serializable: true
    },

    _needsSave: {
        value: false
    },

    needsSave: {
        get: function() {
            return this._needsSave;
        },
        set: function(value) {
            if (this._needsSave !== value) {
                this._needsSave = !!value;
            }
            this.saveButton.disabled = !value;
        }
    },

    _codeMirror: {
        enumerable:false,
        value:null
    },

    didCreate: {
        value: function() {
            var self = this;

            self.addPropertyChangeListener("scriptSource", function (event) {
                if (self.scriptSource) {
                    // Only enable recording is the selected browser is Chrome
                    if (self.selectedAgent && self.selectedAgent.info.capabilities.browserName === "chrome") {
                        self.recordButton.disabled = false;
                    }
                    self.runButton.disabled = false;
                    self.saveButton.disabled = false;
                    self.deleteButton.disabled = false;
                    self.downloadButton.disabled = false;
                }
            });
        }
    },

    prepareForDraw: {
        value: function() {
            var self = this;

            if (this.scriptSource) {
            }
            var options = {
                mode: 'javascript',
                lineNumbers: true,
                gutter:true,
                onChange: function(codeMirror) {
                    self.needsSave = true;
                }
            };
            this._codeMirror = CodeMirror.fromTextArea(this.scriptCode.element, options);

            this.scriptNameField.addPropertyChangeListener("value", function(event) {
                if (self.scriptSource.name !== self.scriptNameField.value) {
                    self.needsSave = true;
                }
            }, false);

            this.scriptTags.addPropertyChangeListener("value", function(event) {
                if (self.scriptSource.displayTags !== self.scriptTags.value) {
                    self.needsSave = true;
                }
            }, false);

            this.element.addEventListener("keydown", this);
            this.urlPrompt.addEventListener("message.ok", function(event) {
                self.urlPromptOk();
            });
        }
    },

    didDraw: {
        value: function() {
            if(this._codeMirror && this.scriptSource) {
                this._codeMirror.refresh();
            }
        }
    },

    handleKeydown: {
        value: function(event) {
            if (event.keyCode == 'S'.charCodeAt(0)) {
                if (event.metaKey) { // OSX save
                    this.saveScriptSource();
                    event.preventDefault();
                } else if (event.ctrlKey) { // Windows/Linux save
                    this.saveScriptSource();
                    event.preventDefault();
                }
            }
        }
    },

    runScriptSource: {
        value: function() {
            var self = this;

            if (!self.activeAgents || self.activeAgents.length < 1) {
                Alert.show("You must select at least one agent from the list to run the test.");
                return;
            }

            if (window.webkitNotifications) {
                window.webkitNotifications.requestPermission(runScript);
            } else {
                runScript();
            }

            function runScript() {
                // We will post the code directly to the server so that you don't have to save to see your changes
                var code = self._codeMirror.getValue();
                var agentCount = self.activeAgents.length;
                for (var i = 0; i < agentCount; ++i) {
                    var agent = self.activeAgents[i];
                    var req = new XMLHttpRequest();
                    req.open("POST", "/screening/api/v1/agents/" + agent.info.id +
                        "/execute_serialized_code?api_key=5150", true);
                    req.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
                    var requestBody = {
                        code: code,
                        name: self.scriptSource.name,
                        preferences: PreferenceManager.getPreferences()
                    };
                    req.send(JSON.stringify(requestBody));
                }
            }
        }
    },

    showResult: {
        value: function() {
            var self = this;
            if (!self.lastTestResult) return;

            var resultId = self.lastTestResult._id;

            // If Desktop Notifications are not available fallback to opening a new window
            if (!window.webkitNotifications || window.webkitNotifications.checkPermission() > 0) {
                window.open("/screening/control-room/script-result.html?" + resultId);
            } else {
                var popup = window.webkitNotifications.createHTMLNotification("/screening/control-room/script-result-popup.html?" + resultId);

                // When you click anywhere in the popup it'll open the result page
                popup.onclick = function() {
                    window.open("/screening/control-room/script-result.html?" + resultId);
                    popup.cancel();
                };
                popup.show();

                setTimeout(function() {
                    popup.cancel();
                }, 10000);
            }
        }
    },

    showAllResults: {
        value: function() {
            window.open("/screening/control-room/script-results.html");
        }
    },

    showSettings: {
        value: function() {
            document.location = "/screening/control-room/preferences.html";
        }
    },

    deleteScriptSource: {
        value: function() {
            var self = this;
            Confirm.show("Are you sure you want to delete this script?", function() {
                // OK
                var req = new XMLHttpRequest();
                req.open("DELETE", "/screening/api/v1/scripts/" + self.scriptSource.id + "?api_key=5150", true);
                self.needsSave = false;
                req.onload = function(event) {
                    console.log('deleting the script source response:' + event);
                    self._dispatchDeleted();
                };
                req.send(null);
            }, function() {
                // Cancel
                // Do nothing for now
            });
        }
    },

    downloadScriptSource: {
        value: function() {
            var self = this;
            window.location.href = "/screening/api/v1/scripts/" + self.scriptSource.id + "/download?api_key=5150";
        }
    },

    saveScriptSource: {
        value: function() {
            // update the code
            var id = this.scriptSource.id;
            this.scriptSource.name = this.scriptNameField.value;
            this.scriptSource.code = this._codeMirror.getValue();

            var self = this;
            var req = new XMLHttpRequest();
            req.open("PUT", "/screening/api/v1/scripts/" + id + "?api_key=5150", true);
            req.onload = function(event) {
                if (event.target.status === 500) {
                    try {
                        var res = JSON.parse(event.target.responseText);
                        var resError = JSON.parse(res.error);
                        // Error codes from: http://www.mongodb.org/display/DOCS/Error+Codes duplicate keys
                        if (resError.lastErrorObject.code === 11000 || resError.lastErrorObject.code === 11001) {

                            Alert.show("The script name '" + self.scriptSource.name + "' already exists. Please choose a different name.");
                        } else {
                            Alert.show("Unknown error trying to save script:" + resError.lastErrorObject.code);
                        }
                    } catch(err) {
                        Alert.show("Unknown error trying to save script: " + err);
                    }
                }
                self.needsDraw = true;
                self.needsSave = false;
            };
            req.setRequestHeader("Content-Type", "application/json");

            // Parse tags
            var str = self.scriptTags.value;
            var tags = str.match(/\w+|"[^"]+"/g);
            // Remove quotes

            if (tags) {
                tags.forEach(function(elem, index) {
                    tags[index] = tags[index].replace(/"/g, "");
                });
            }

            var reqBody = {
                name: self.scriptSource.name,
                code: self.scriptSource.code,
                tags: tags
            }
            req.send(JSON.stringify(reqBody));
        }
    },

    appendCode: {
        value: function(code) {
            if (code.length == 0) {
                return;
            }

            var existingCode = this._codeMirror.getValue();
            if (existingCode.length > 0) {
                existingCode += "\r\n";
            }

            this._codeMirror.setValue(existingCode + code);
        }
    },

    recordScript: {
        value: function() {
            if (this._recordingAgent) {
                this.stopRecording();
                return;
            }

            if (!this.activeAgents || this.activeAgents.length < 1) {
                Alert.show("You must select at least one agent from the list to record.");
                return;
            }
            this.startRecording();
        }
    },

    startRecording: {
        value: function() {
            var popup = Popup.create();
            popup.content = this.urlPrompt; // the content inside the Popup
            popup.target = this.recordButton.element;
            popup.modal = true;
            popup.show();
        }
    },

    urlPromptOk: {
        value: function() {
            if (!this.activeAgents || this.activeAgents.length < 1) {
                Alert.show("You must select at least one agent from the list to record.");
                return;
            }
            var agent = this.activeAgents[0];
            var urlToRecord = this.urlPrompt.value;
            this._recordingAgent = agent;
            this.recordButton.label = "Stop Recording";
            this._recordingPaused = false;
            this.pauseRecordButton.element.style.display = "inline-block";
            this.pauseRecordButton.label = "Pause Recording";

            var req = new XMLHttpRequest();
            req.open("POST", "/screening/api/v1/agents/" + agent.info.id + "/recording?api_key=5150", true);
            req.setRequestHeader("Content-Type", "application/json");
            req.send(JSON.stringify({url: urlToRecord}));
        }
    },

    stopRecording: {
        value: function() {
            var agent = this._recordingAgent;
            this._recordingAgent = null;
            this.recordButton.label = "Record";
            this.pauseRecordButton.element.style.display = "none";

            var self = this;
            var req = new XMLHttpRequest();
            req.open("DELETE", "/screening/api/v1/agents/" + agent.info.id + "/recording?api_key=5150", true);
            req.onload = function(event) {
                var responseBody = JSON.parse(this.responseText);
                self.appendCode(responseBody.source);
            };
            req.send(null);
        }
    },

    pauseRecordScript: {
        value: function() {
            if (this._recordingPaused) {
                this.resumeRecording();
                return;
            }

            this.pauseRecording();
        }
    },

    pauseRecording: {
        value: function() {
            var agent = this._recordingAgent;
            this._recordingPaused = true;
            this.pauseRecordButton.label = "Resume Recording";

            var self = this;
            var req = new XMLHttpRequest();
            req.open("PUT", "/screening/api/v1/agents/" + agent.info.id + "/recording/pause?api_key=5150", true);
            req.onload = function(event) {
                var responseBody = JSON.parse(this.responseText);
                self.appendCode(responseBody.source);
            };
            req.send(null);
        }
    },

    resumeRecording: {
        value: function() {
            var agent = this._recordingAgent;
            this._recordingPaused = false;
            this.pauseRecordButton.label = "Pause Recording";

            var self = this;
            var req = new XMLHttpRequest();
            req.open("PUT", "/screening/api/v1/agents/" + agent.info.id + "/recording/resume?api_key=5150", true);
            req.send(null);
        }
    },

    _dispatchDeleted: {
        value: function() {
            var event = document.createEvent("CustomEvent");
            event.initCustomEvent("scriptDeleted", true, false);
            event.script = this.scriptSource;
            this.dispatchEvent(event);
        }
    },

    unsavedChangesConfirm: {
        value: function(cbOk, cbCancel) {
            var self = this;
            cbCancel = cbCancel || function() {};
            Confirm.show("Your script has unsaved changes. Continuing will discard any unsaved changes. Do you wish to continue?", cbOk, cbCancel);
        }
    },

    clearFields: {
        /**
         * Clear the script name, tags and content.
         */
        value: function() {
            var self = this;

            self.scriptNameField.value = "";
            self.scriptTags.value = "";
            self._codeMirror.setValue("");

            // Disable the Record, Run, etc buttons
            self.recordButton.disabled = true;
            self.runButton.disabled = true;
            self.saveButton.disabled = true;
            self.deleteButton.disabled = true;
            self.downloadButton.disabled = true;
        }
    }
});
