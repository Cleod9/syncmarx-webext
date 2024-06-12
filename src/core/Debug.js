require('es6-promise').polyfill();
var browser = require('webextension-polyfill');
import * as SaveData from 'util/SaveData';
import Logger from 'util/Logger';

var logger = new Logger('[Debug.js]');
var manager = null;

// Note: This class is used to assist with debugging in dev environments. Can add additional methods as needed here.

export var init = function (managerInstance) {
  manager = managerInstance;
  // globalThis.manager = manager;
};

export var updateSettings = function (obj) {
  var settings = SaveData.getSettings();
  for (var i in obj) {
    settings[i] = obj[i];
  }

  return saveSettings(settings);
};

export var saveSettings = function (settings) {
  return SaveData.saveSettings(settings)
    .catch(function (e) {
      logger.error('Problem saving:', e);
    });
};

export var clearProfile= function () {
  manager.profileName = null;
};

export var clearSettings = function () {
  return SaveData.clearSettings();
};

