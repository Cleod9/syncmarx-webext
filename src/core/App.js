import 'isomorphic-fetch';
require('es6-promise').polyfill();
window.browser = require('webextension-polyfill');
import BookmarkManager from 'core/BookmarkManager';
import Logger from 'util/Logger';
import * as Debug from 'core/Debug';
import * as SaveData from 'util/SaveData';

var logger = new Logger('[App.js]');
var manager = new BookmarkManager();
var version = require('../../version.json');

SaveData.init(manager);

/*
 * Updates the browserAction icon to reflect whether the current page
 * is already bookmarked.
 */
function updateIcon(type) {
  if (type === 'disabled') {
    browser.browserAction.setIcon({
      path: {
        19: "icons/icon_disabled_19.png",
        38: "icons/icon_disabled_38.png"
      }
    });
  } else if (type === 'syncing') {
    browser.browserAction.setIcon({
      path: {
        19: "icons/icon_sync_19.png",
        38: "icons/icon_sync_38.png"
      }
    });
  } else if (type === 'normal') {
    browser.browserAction.setIcon({
      path: {
        19: "icons/icon_19.png",
        38: "icons/icon_38.png"
      }
    });
  }
}

/*
 * Add or remove the bookmark on the current page.
 */
browser.browserAction.setPopup({
  popup: 'settings.htm'   
});

// Add message listener
browser.runtime.onMessage.addListener(function (data) {
  if (data.action === 'init') {
    browser.runtime.sendMessage({ action: 'initComplete', authorized: manager.provider.isAuthed(), compression: manager.compression });
  } else if (data.action === 'auth') {
    updateIcon('syncing');
    manager.auth(data.provider, data.credentials)
      .then(function () {
        logger.log("Authorization successful")
        return SaveData.saveSettings()
          .then(function () {
            browser.runtime.sendMessage({ action: 'authComplete', accessToken: data.accessToken });
          });
      })
      .then(function () {
        updateIcon('normal');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'authError', message: formatRejection(e, 'Invalid access token') });
      });
  } else if (data.action === 'deauth') {
    updateIcon('syncing');
    manager.revokeAuth()
      .catch(function (e) {
        logger.error('Problem deauthorizing token', e);
      })
      .then(function () {
        return browser.storage.local.remove(['accessToken'])
      })
      .then(function () {
        manager.init();
        logger.log("Dropbox key has been removed")
        browser.runtime.sendMessage({ action: 'deauthComplete' });
      })
      .then(function () {
        updateIcon('disabled');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'deauthError', message: formatRejection(e, 'An unknown error occured') });
      });
  } else if (data.action === 'push') {
    updateIcon('syncing');
    manager.push()
      .then(function () {
        return SaveData.saveSettings();
      })
      .then(function () {
        browser.runtime.sendMessage({ action: 'pushComplete', lastSyncTime: manager.lastSyncTime, totalBookmarks: BookmarkManager.bookmarkCountBuffer, totalFolders: BookmarkManager.folderCountBuffer });
      })
      .then(function () {
        updateIcon('normal');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'pushError', message: formatRejection(e, 'Failed to push bookmark data') });
      });
  } else if (data.action === 'pull') {
    updateIcon('syncing');
    manager.pull()
      .then(function () {
        return SaveData.saveSettings();
      })
      .then(function () {
        browser.runtime.sendMessage({ action: 'pullComplete', lastSyncTime: manager.lastSyncTime, totalBookmarks: BookmarkManager.bookmarkCountBuffer, totalFolders: BookmarkManager.folderCountBuffer, compression: manager.compression });
      })
      .then(function () {
        updateIcon('normal');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'pullError', message: formatRejection(e, 'Failed to pull bookmark data') });
      });
  } else if (data.action === 'sync') {
    updateIcon('syncing');
    manager.sync()
      .then(function () {
        return SaveData.saveSettings();
      })
      .then(function () {
        browser.runtime.sendMessage({ action: 'syncComplete', lastSyncTime: manager.lastSyncTime, totalBookmarks: BookmarkManager.bookmarkCountBuffer, totalFolders: BookmarkManager.folderCountBuffer, compression: manager.compression });
      })
      .then(function () {
        updateIcon('normal');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'syncError', message: formatRejection(e, 'Failed to sync bookmark data') });
      });
  } else if (data.action === 'getProfiles') {
    manager.resetSyncRate();

    manager.getProfiles()
      .then(function (profiles) {
        return manager.loadLocalData()
          .then(() => {
            browser.runtime.sendMessage({ action: 'getProfilesComplete', profiles: profiles, selectedProfile: manager.profilePath, syncRate: manager.syncRate, lastSyncTime: manager.lastSyncTime, totalBookmarks: BookmarkManager.bookmarkCountBuffer, totalFolders: BookmarkManager.folderCountBuffer });
          });
      })
      .catch(function (e) {
        logger.error(e);
        browser.runtime.sendMessage({ action: 'getProfilesError', message: formatRejection(e, 'Could not retrieve profiles') });
      });
  } else if (data.action === 'selectProfile') {
    updateIcon('syncing');
    manager.profilePath = data.profilePath;
    manager.resetSyncRate();

    SaveData.saveSettings()
      .then(function () {
        browser.runtime.sendMessage({ action: 'selectProfileComplete', selectedProfile: manager.profilePath, lastSyncTime: manager.lastSyncTime });
      })
      .then(function () {
        updateIcon('normal');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'selectProfileError', message: formatRejection(e, 'An error occured while selecting profile') });
      });
  } else if (data.action === 'createProfile') {
    updateIcon('syncing');
    manager.profilePath = '/' + data.name + '.syncmarx';
    manager.resetSyncRate();

    manager.push()
      .then(function () {
        return manager.getProfiles()
          .then(function (profiles) {
            return SaveData.saveSettings()
              .then(function () {
                browser.runtime.sendMessage({ action: 'createProfileComplete', profiles: profiles, selectedProfile: manager.profilePath });
              });
          });
      })
      .then(function () {
        updateIcon('normal');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'createProfileError', message: formatRejection(e, 'An error occured while creating profile') });
      });
    } else if (data.action === 'changeSyncRate') {
      manager.changeSyncRate(data.syncRate);

      SaveData.saveSettings()
        .then(function () {
          browser.runtime.sendMessage({ action: 'changeSyncRateComplete', syncRate: data.syncRate });
        })
        .catch(function (e) {
          logger.error(e);
          updateIcon('disabled');
          browser.runtime.sendMessage({ action: 'changeSyncRateError', message: formatRejection(e, 'An error occured while updating sync interval') });
        });
    } else if (data.action === 'changeCompression') {
      manager.compression = data.compression;

      SaveData.saveSettings()
        .then(function () {
          browser.runtime.sendMessage({ action: 'changeCompressionComplete', compression: data.compression });
        })
        .catch(function (e) {
          logger.error(e);
          updateIcon('disabled');
          browser.runtime.sendMessage({ action: 'changeCompressionError', message: formatRejection(e, 'An error occured while changing compression setting') });
        });
    }
});

/**
 * Takes a Promise rejection and default text, and only returns the rejection if it's a string
 * (Considering strings to be user-friendly errors)
 * @param {Error|string} e Rejected value
 * @param {string} defaultText Fallback text
 */
function formatRejection(e, defaultText) {
  if (typeof e === 'string') {
    return e;
  } else {
    return defaultText;
  }
}

/**
 * Attach callback hook for auto-sync
 */
manager.onAutoSyncHook = function () {
  SaveData.saveSettings();
};


// Always start the app showing the syncing symbol
updateIcon('syncing');

SaveData.loadSettings()
  .then(function (settings) {
    logger.log('Loaded settings:', settings);
    // Store the remembered profile
    if (settings.profilePath) {
      manager.profilePath = settings.profilePath;
    }

    // Use the last sync time to remember when was last synced
    if (settings.lastSyncTime) {
      manager.lastSyncTime = settings.lastSyncTime;
    }

    // Update the sync rate
    if (settings.syncRate) {
      manager.changeSyncRate(settings.syncRate);
    }

    // Update the compression setting
    manager.compression = (settings.compression) ? true : false;

    // Test login to Dropbox
    if (settings.credentials) {
      return manager.auth(settings.provider, settings.credentials)
        .then(function () {
          updateIcon('normal');
          logger.log('App is authorized');
        });
    } else {
      updateIcon('disabled');
      logger.log('App is unauthorized');
    }
  })
  .then(function () {
    return manager.loadLocalData();
  })
  .then(function () {
    if (manager.provider.isAuthed() && manager.syncRate !== 0) {
      return manager.sync();
    }
  })
  .then(function () {
    return SaveData.saveSettings();
  })
  .then(function () {
    logger.log('Initialization completed');
  })
  .catch(function (e) {
    logger.error('Problem launching app', e);
    updateIcon('disabled');
  });


// Attach DEBUG to window for non-production build
if (!PRODUCTION) {
  Debug.init(manager);
  window.DEBUG = Debug;
}