import 'isomorphic-fetch';
require('es6-promise').polyfill();
require('es6-symbol/implement');
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

/**
 * Listens for incoming messages from the extension UI.
 * 
 * TODO: Break out conditionals to separate functions to make the data params clearer
 */
browser.runtime.onMessage.addListener(function (data) {
  if (data.action === 'init') {
    // Initialize the extension
    browser.runtime.sendMessage({ action: 'initComplete', authorized: manager.provider.isAuthed(), compression: manager.compression, providerDropdown: manager.providerDropdown });
  } else if (data.action === 'auth') {
    // Authorize to third party provider using provided credentials
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
    // Authorize to third party provider using provided credentials
    updateIcon('syncing');
    manager.revokeAuth()
      .catch(function (e) {
        logger.error('Problem deauthorizing token', e);
      })
      .then(function () {
        logger.log(manager.provider.getType() + " access token has been removed");

        manager.init();

        return SaveData.saveSettings();
      })
      .then(function () {
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'deauthComplete' });
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'deauthError', message: formatRejection(e, 'An unknown error occured') });
      });
  } else if (data.action === 'push') {
    // Force push bookmarks to the remote service
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
    // Force pull bookmarks from the remote service
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
    // Manually run a sync
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
    // Returns the list of profiles stored in the remote service
    manager.resetSyncRate();

    manager.getProfiles()
      .then(function (profiles) {
        return manager.loadLocalData()
          .then(() => {
            browser.runtime.sendMessage({ action: 'getProfilesComplete', profiles: profiles, selectedProfile: manager.getCurrentProfile(), provider: manager.provider.getType(), syncRate: manager.syncRate, lastSyncTime: manager.lastSyncTime, totalBookmarks: BookmarkManager.bookmarkCountBuffer, totalFolders: BookmarkManager.folderCountBuffer });
            updateIcon('normal');
          });
      })
      .catch(function (e) {
        logger.error(e);
        browser.runtime.sendMessage({ action: 'getProfilesError', message: formatRejection(e, 'Could not retrieve profiles') });
        updateIcon('disabled');
      });
  } else if (data.action === 'selectProfile') {
    // Select a profile from te remote service
    updateIcon('syncing');
    manager.profileName = data.name;
    manager.resetSyncRate();

    SaveData.saveSettings()
      .then(function () {
        browser.runtime.sendMessage({ action: 'selectProfileComplete', selectedProfile: manager.getCurrentProfile(), lastSyncTime: manager.lastSyncTime });
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
    // Create a new profile on the remote service
    if (!data.name.match(/^[\w\-. ]+$/g)) {
      // Limit the characters to play it safe (since most file services require valid file names, and we use this as the file name)
      browser.runtime.sendMessage({ action: 'createProfileError', message: 'Invalid profile name: ' + data.name });
      return;
    }
    updateIcon('syncing');
    manager.profileName = data.name;
    manager.resetSyncRate();

    manager.push()
      .then(function () {
        return manager.getProfiles()
          .then(function (profiles) {
            return SaveData.saveSettings()
              .then(function () {
                browser.runtime.sendMessage({ action: 'createProfileComplete', profiles: profiles, selectedProfile: manager.getCurrentProfile() });
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
      // Update the sync rate setting
      manager.changeSyncRate(data.syncRate);

      SaveData.saveSettings()
        .then(function () {
          browser.runtime.sendMessage({ action: 'changeSyncRateComplete', syncRate: manager.syncRate });
        })
        .catch(function (e) {
          logger.error(e);
          updateIcon('disabled');
          browser.runtime.sendMessage({ action: 'changeSyncRateError', message: formatRejection(e, 'An error occured while updating sync interval') });
        });
    } else if (data.action === 'changeCompression') {
      // Update the compression setting
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
    } else if (data.action === 'changeProviderDropdown') {
      // Persist the last chosen provider in saved config
      manager.providerDropdown = data.providerDropdown;

      SaveData.saveSettings()
        .then(function () {
          browser.runtime.sendMessage({ action: 'changeProviderDropdownComplete', providerDropdown: manager.providerDropdown });
        })
        .catch(function (e) {
          logger.error(e);
          browser.runtime.sendMessage({ action: 'changeProviderDropdownError', message: formatRejection(e, 'An error occured while selecting provider') });
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
    if (settings.profileName) {
      manager.profileName = settings.profileName;
    }

    // Use the last sync time to remember when was last synced
    if (settings.lastSyncTime) {
      manager.lastSyncTime = settings.lastSyncTime;
    }

    // Update the sync rate
    if (typeof settings.syncRate === 'number' && settings.syncRate >= 0) {
      manager.changeSyncRate(settings.syncRate);
    }

    // Update the compression setting
    manager.compression = (settings.compression) ? true : false;

    // Update the provider dropdown setting
    manager.providerDropdown = settings.providerDropdown;

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
      manager.getProfiles()
        .then(function () {
          return manager.sync();
        });
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