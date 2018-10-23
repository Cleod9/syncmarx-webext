
/**
 * Persistent settings management
 */

import Logger from 'util/Logger';

var logger = new Logger('[SaveData.js]');
var manager = null;

/**
 * Assigns bookmark manager instance to pull data from when saving
 */
export var init = function (managerInstance) {
  manager = managerInstance;
}

/**
 * Load settings from local storage and migrate the data
 */
export var loadSettings = function () {
  return browser.storage.local.get()
    .then(function (results) {
      return migrateSettings(results);
    });
};

/**
 * Create settings object
 */
export var getSettings = function () {
  return {
      migration: '03_dropdown_setting',
      profilePath: manager.profilePath,
      lastSyncTime: manager.lastSyncTime,
      syncRate: manager.syncRate,
      provider: manager.provider.getType(),
      credentials: manager.provider.getCredentials(),
      compression: manager.compression,
      providerDropdown: manager.providerDropdown
  };
};

/**
 * Save settings to local storage
 * @param {object} settings If provided, saves the provided object. Otherwise pulls via getSettings()
 */
export var saveSettings = function (settings) {
  settings = settings || getSettings();

  return browser.storage.local.set({ data: JSON.stringify(settings) }) 
    .then(function () {
      logger.log('Settings have been saved', settings);
    });
};


/**
 * Migrates provided settings object structure
 */
export var migrateSettings = function (settings) {
  // Migrate settings to a newer version
  if (!settings.data && settings.accessToken) {
    // Data param hasn't been added yet (pre 0.3)
    // Clear out local storage
    return browser.storage.local.clear()
      .then(() => {
        // Inject migration field
        settings.migration = '00_migration_init';
        logger.info("Migrated storage to " + settings.migration);

        // Finish migration
        return migrateSettings({ data: JSON.stringify(settings) })
          .then((results) => {
            return saveSettings(settings)
              .then(() => {
                // Return the results
                return results;
              });
          });
      });
  } else {
    if (settings.data) {
      // Extract data object
      settings = JSON.parse(settings.data);
    } else {
      // First time load, create a new settings object
      settings = getSettings();
    }

    if (settings.migration === '00_migration_init') {
      // Create credentials field and migrate existing access token
      settings.provider = 'dropbox';
      settings.credentials = {
        accessToken: settings.accessToken
      };

      // Strip access token field
      delete settings.accessToken;

      settings.migration = '01_credentials_struct';
      logger.info("Migrated storage to " + settings.migration);
    }
    if (settings.migration === '01_credentials_struct') {
      // Add compression field
      settings.compression = true;

      settings.migration = '02_compression_setting';
    }
    if (settings.migration === '02_compression_setting') {
      // Add providerDropdown field
      settings.providerDropdown = 'dropbox';

      settings.migration = '03_dropdown_setting';
    }

    logger.info("Migrations completed");

    return Promise.resolve(settings);
  }
};

export var clearSettings = function () {
  manager.init();

  return saveSettings();
};