import 'isomorphic-fetch';
import BookmarkManager from 'bookmark-manager';

require('es6-promise').polyfill();
var detect = require('detect-browser').detect;
window.browser = require('webextension-polyfill');
import Logger from 'logger';

var logger = new Logger('[app.js] ');
var manager = new BookmarkManager();
var BROWSER_NAME = detect().name;

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
  if (data.action === 'auth') {
    updateIcon('syncing');
    manager.auth(data.accessToken, data.storageProvider)
      .then(function () {
        logger.log("Authorization successful")
        return browser.storage.local.set({ accessToken: data.accessToken })
          .then(function (profiles) {
            browser.runtime.sendMessage({ action: 'authComplete', accessToken: data.accessToken });
            logger.log("Stored access token");
          });
      })
      .then(function () {
        updateIcon('normal');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'authError', message: 'Invalid access token' });
      });
  } else if (data.action === 'deauth') {
    updateIcon('syncing');
    manager.revokeAuth()
      .then(function () {
        return browser.storage.local.remove(['accessToken'])
      })
      .then(function () {
        manager.init();
        logger.log("Dropbox key has been removed")
        browser.runtime.sendMessage({ action: 'deauthComplete' });
      })
      .then(function () {
        updateIcon('normal');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'deauthError', message: 'An unknown error occured' });
      });
  } else if (data.action === 'push') {
    updateIcon('syncing');
    manager.push()
      .then(function () {
        return saveSettings();
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
        browser.runtime.sendMessage({ action: 'pushError', message: 'Failed to push bookmark data' });
      });
  } else if (data.action === 'pull') {
    updateIcon('syncing');
    manager.pull()
      .then(function () {
        return saveSettings();
      })
      .then(function () {
        browser.runtime.sendMessage({ action: 'pullComplete', lastSyncTime: manager.lastSyncTime, totalBookmarks: BookmarkManager.bookmarkCountBuffer, totalFolders: BookmarkManager.folderCountBuffer });
      })
      .then(function () {
        updateIcon('normal');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'pushError', message: 'Failed to pull bookmark data' });
      });
  } else if (data.action === 'sync') {
    updateIcon('syncing');
    manager.sync()
      .then(function () {
        return saveSettings();
      })
      .then(function () {
        browser.runtime.sendMessage({ action: 'syncComplete', lastSyncTime: manager.lastSyncTime, totalBookmarks: BookmarkManager.bookmarkCountBuffer, totalFolders: BookmarkManager.folderCountBuffer });
      })
      .then(function () {
        updateIcon('normal');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
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
      .catch(function (err) {
        logger.error(err);
        browser.runtime.sendMessage({ action: 'pushError', message: 'Could not retrieve profiles' });
      });
  } else if (data.action === 'selectProfile') {
    updateIcon('syncing');
    manager.profilePath = data.profilePath;
    manager.resetSyncRate();

    saveSettings()
      .then(function () {
        browser.runtime.sendMessage({ action: 'selectProfileComplete', selectedProfile: manager.profilePath, lastSyncTime: manager.lastSyncTime });
      })
      .then(function () {
        updateIcon('normal');
      })
      .catch(function (e) {
        logger.error(e);
        updateIcon('disabled');
        browser.runtime.sendMessage({ action: 'pushError', message: 'An error occured while selecting profile' });
      });
  } else if (data.action === 'createProfile') {
    updateIcon('syncing');
    manager.profilePath = '/' + data.name + '.syncmarx';
    manager.resetSyncRate();

    manager.push()
      .then(function () {
        return manager.getProfiles()
          .then(function (profiles) {
            return saveSettings()
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
        browser.runtime.sendMessage({ action: 'pushError', message: 'An error occured while creating profile' });
      });
    } else if (data.action === 'changeSyncRate') {
      manager.changeSyncRate(data.syncRate);

      saveSettings()
        .then(function () {
          browser.runtime.sendMessage({ action: 'changeSyncRateComplete', syncRate: data.syncRate });
        })
        .catch(function (e) {
          logger.error(e);
          updateIcon('disabled');
          browser.runtime.sendMessage({ action: 'pushError', message: 'An error occured while updating sync interval' });
        });
    }
});

function saveSettings() {
  let settings = {
    profilePath: manager.profilePath,
    lastSyncTime: manager.lastSyncTime,
    storageProvider: manager.storageProvider,
    accessToken: manager.dbx.getAccessToken(),
    syncRate: manager.syncRate
  };

  return browser.storage.local.set(settings) 
    .then(function () {
      logger.log('Settings have been saved', settings);
    });
};

manager.onAutoSyncHook = saveSettings;

updateIcon('syncing');

browser.storage.local.get()
  .then(function (results) {
    logger.log('Loaded settings:', results);
    // Store the remembered profile
    if (results.profilePath) {
      manager.profilePath = results.profilePath;
    }

    // Use the last sync time to remember when was last synced
    if (results.lastSyncTime) {
      manager.lastSyncTime = results.lastSyncTime;
    }

    // Update the sync rate
    if (results.syncRate) {
      manager.changeSyncRate(results.syncRate);
    }

    // Test login to Dropbox
    if (results.accessToken) {
      return manager.auth(results.accessToken, results.storageProvider)
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
    if (manager.dbx.getAccessToken() && manager.syncRate !== 0) {
      return manager.sync();
    }
  })
  .then(function () {
    return saveSettings();
  })
  .then(function () {
    logger.log('Initialization completed');
  })
  .catch(function (e) {
    logger.error('Problem launching app', e);
    updateIcon('disabled');
  });
