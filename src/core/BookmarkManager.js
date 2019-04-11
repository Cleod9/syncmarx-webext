require('isomorphic-fetch');
require('es6-promise').polyfill();
var _ = require('lodash');
var LZString = require('lz-string');
var Cryptr = require('cryptr');
import Logger from 'util/Logger';
import StorageProvider from 'providers/StorageProvider';

import Dropbox from 'providers/Dropbox';
import GoogleDrive from 'providers/GoogleDrive';
import Box from 'providers/Box';

var logger = new Logger('[BookmarkManager.js]');
var detect = require('detect-browser').detect;
var BROWSER_NAME = detect().name;

var DATA_VERSION = 1; // Versioning for bookmarks data

// Browser-specific names for root folders
var MENU_TITLES = /(^Bookmarks Menu$)|(^Other bookmarks$)|(^Bookmarks$)/gi;
var TOOLBAR_TITLES = /(^Bookmarks Toolbar$)|(^Bookmarks bar$)/gi;

// TODO: Either make an explicit mapping or remove this root map, since it is not used
var ROOT_MAP = {
  firefox: {
    'toolbar': 'Bookmarks Toolbar',
    'menu': 'Bookmarks Menu'
  },
  chrome: {
    'toolbar': 'Bookmarks bar',
    'menu': 'Other bookmarks'
  }
};

// https://stackoverflow.com/questions/41607804/promise-each-without-bluebird
var Promise_each = function(arr, fn) { // take an array and a function
  // invalid input
  if(!Array.isArray(arr)) return Promise.reject(new Error("Non array passed to each"));
  // empty case
  if(arr.length === 0) return Promise.resolve(); 
  return arr.reduce(function(prev, cur) {
    return prev.then(() => {
      return fn(cur);
    });
  }, Promise.resolve());
}

/**
 * Takes a given bookmark and converts the url to something usable by the browser vendor
 */
var incomingUrlFixer = function (bookmark, originalNode) {
  if (BROWSER_NAME === 'firefox' && bookmark.url && bookmark.url.match(/^chrome:\/\//)) {
    logger.log("Fixing incoming chrome url for Firefox: " , bookmark);

    // Firefox has issue with some chrome:// urls. Let's perform a failsafe
    bookmark.url = bookmark.url.replace(/^chrome:\/\//, 'http://chrome//');

    return browser.bookmarks.create(bookmark);
  } else if (BROWSER_NAME === 'firefox' && originalNode.type === 'separator') {
    // Hack for Firefox ('separator' is technically not a standard, valid type)
    logger.log("Fixing incoming separator for Firefox: " , bookmark);

    bookmark.type = 'separator';

    return browser.bookmarks.create(bookmark);
  } else {
    throw new Error("Incompatible bookmark format");
  }
};

/**
 * Takes a given bookmark and converts it to its original url
 */
var outgoingUrlFix = function (bookmark) {
  if (BROWSER_NAME === 'firefox' && bookmark.url && bookmark.url.match(/^http:\/\/chrome\/\//)) {
    logger.log("Fixing outgoing chrome url for Firefox: " , bookmark);

    // Undo failsafe for Firefox chrome:// urls
    bookmark.url = bookmark.url.replace(/^http:\/\/chrome\/\//, 'chrome://');
  }
};

export default class BookmarkManager {
  constructor() {
    this.autoSync = this.autoSync.bind(this);
  
    this.init();
    
    // Only run when the class is first created (Used to track drop down on auth page)
    this.providerDropdown = this.provider.getType();
  }
  
  /**
   * Resets manager
   */
 init() {
    this.provider = new Dropbox();
    this.profileName = null;
    this.profiles = null;
    this.lastSyncTime = 0;
    this.syncRate = 15; // Default to 15 minutes
    this.syncInterval = 0;
    this.compression = true;
    this.lastPullCompression = true;
    this.localData = null; // { lastModified:number; DATA_VERSION: 1, data:BookmarkTreeNode}
    this.onAutoSyncHook = null;
    clearInterval(this.syncInterval);

    this.resetSyncRate();
  }

  getCurrentProfile() {
    return _.find(this.profiles, (profile) => {
      return profile.name === this.profileName;
    }) || null;
  }

  /**
   * Loads local bookmark data into the manager
   */
 loadLocalData() {
    return browser.bookmarks.getTree()
      .then((bookmarks) => {
        BookmarkManager.resetCountBuffers();

        var result = BookmarkManager.treeNodesToJSON(bookmarks[0]);
        var json = {
          lastModified: this.lastSyncTime,
          version: DATA_VERSION,
          data: result
        };
        logger.log("Tree to JSON: " , result);

        this.localData = json;
    });
  }

  /**
   * Sets acces token for authoriation and performs a test operation via getProfiles()
   */
 auth(provider, credentials) {
    logger.log("Start auth");
    if (!credentials) {
      return Promise.reject('Error, no credentials provided');
    }

    if (provider === 'dropbox') {
      this.provider = new Dropbox();
    } else if (provider === 'googledrive') {
      this.provider = new GoogleDrive();
    } else if (provider === 'box') {
      this.provider = new Box();
    } else {
      logger.error('Invalid provider', provider);
      return Promise.reject('Invalid provider');
    }
    
    return this.provider.authorize(credentials)
      .catch((e) => {
        // Reset to empty Dropbox provider
        this.provider = new Dropbox();
        throw e;
      });
  }

  /**
   * Sets access token for authoriation and performs a test operation via getProfiles()
   */
  revokeAuth() {
    logger.log("Revoke auth");
    if (!this.provider.isAuthed()) {
      return Promise.reject('Error, no token to be revoked');
    }

    return this.provider.deauthorize();
  }
  
  /**
   * Retrieves bookmark profiles saved under the syncmarx app folder
   */
 getProfiles() {
    if (!this.provider.isAuthed()) {
      return Promise.reject('Error cannot retrieve bookmark data, no access token provided');
    }
    
    return this.provider.filesList()
      .then((entries) => {
        this.profiles = entries;

        return this.profiles;
      })
      .catch((error) => {
        logger.error(JSON.stringify(error));

        throw error;
      });
  }

  /**
   * Overwrites bookmarks on the server with local copy
   */
  push() {
    logger.log("Start push");
    if (!this.provider.isAuthed()) {
      return Promise.reject('Error during push, no available access token');
    } else if (!this.getCurrentProfile() && !this.profileName) {
      return Promise.reject('Error, a profile must be specified to enable syncing');
    }

    return this.loadLocalData()
      .then(() => {
        this.localData.lastModified = new Date().getTime();
      
        return this.provider.fileUpload({ fileName: this.profileName + '.syncmarx', id: (this.getCurrentProfile()) ? this.getCurrentProfile().id : null, contents: this.localData, compression: this.compression })
          .then(() =>  {
            this.lastSyncTime = this.localData.lastModified;
          })
      })
      .catch((error) => {
        logger.error(error, JSON.stringify(error));
  
        throw error;
      });
  }

  /**
   * Overwrites local bookmarks with the ones on the server
   */
 pull() {
    if (!this.provider.isAuthed()) {
      return Promise.reject('Error during pull, no available access token');
    } else if (!this.getCurrentProfile()) {
      return Promise.reject('Error, a profile must be specified to enable syncing');
    }

    return this.getRemoteData()
      .then((results) => {
        return this.loadLocalData()
          .then(() =>  {
            // Get local data
            var localMenuData = BookmarkManager.findNodeByTitle(MENU_TITLES, this.localData.data, 1);
            var localToolbarData = BookmarkManager.findNodeByTitle(TOOLBAR_TITLES, this.localData.data, 1);

            // Recursively delete children (Disregard toolbar when null, not all browsers follow same structure)
            return Promise_each((localToolbarData) ? localToolbarData.children : [], (child) => {
              return BookmarkManager.applyDeltaDeleteHelper(child);
            })
              .then(() => {
                return Promise_each(localMenuData.children, (child) => {
                  return BookmarkManager.applyDeltaDeleteHelper(child);
                })
                  .then(() => {
                    // Set last sync time to zero to force out-of-date
                    this.lastSyncTime = 0;

                    return this.sync();
                  });
              });
            
          });
      });
  }

  /**
   * Syncs local bookmarks with remote. Logic is as follows:
   * - Fetch remote bookmarks
   * - Compare date between remote VS local
   * - If local is newer, we simply overwrite the remote entirely
   * - If remote is newer, we merge changes with local data and push it back
   */
 sync() {
    logger.log("Start sync");
    
    if (!this.provider.isAuthed()) {
      return Promise.reject('Error during sync, no available access token');
    } else if (!this.getCurrentProfile()) {
      return Promise.reject('Error, a profile must be specified to enable syncing');
    }

    return this.loadLocalData()
      .then(() => {
        // Get local data
        var localMenuData = BookmarkManager.findNodeByTitle(MENU_TITLES, this.localData.data, 1);
        var localToolbarData = BookmarkManager.findNodeByTitle(TOOLBAR_TITLES, this.localData.data, 1);

        return this.getRemoteData()
          .then((remoteData) => {
            var remoteMenuData = BookmarkManager.findNodeByTitle(MENU_TITLES, remoteData.data, 1);
            var remoteToolbarData = (localToolbarData) ? BookmarkManager.findNodeByTitle(TOOLBAR_TITLES, remoteData.data, 1) : [];

            if (!remoteToolbarData) {
              // We may need to dig a little deeper in depth (Hack for vivaldi compatibility, since it doesn ot have dedicated bookmarks bar)
              remoteToolbarData = BookmarkManager.findNodeByTitle(TOOLBAR_TITLES, remoteData.data, 2);
            }

            // Check for deltas between local and remote
            var menuDeltas = BookmarkManager.calculateDeltas(localMenuData, remoteMenuData);
            var toolbarDeltas = (localToolbarData) ? BookmarkManager.calculateDeltas(localToolbarData, remoteToolbarData) : [];

            logger.info('menu deltas:', menuDeltas);
            logger.info('toolbar deltas:', toolbarDeltas);
            
            if (toolbarDeltas.length + menuDeltas.length > 0) {
              // If the remote data is old or equal in age
              if (this.lastSyncTime >= remoteData.lastModified) {
                // We can simply push what we have
                logger.log('Sync completed (Force push)');
                return this.push();
              } else {
                // We need to merge changes with that of the remote
                return Promise_each(_.concat(toolbarDeltas, menuDeltas), (delta) => {
                  return BookmarkManager.applyDelta(delta)
                })
                  .then((results) => {
                      // Let's push the new data
                      this.lastSyncTime = remoteData.lastModified;
                      logger.log('Sync completed (Merged, no need to push)');
                  });
              }
            } else {
              this.lastSyncTime = remoteData.lastModified;
              logger.log('Sync completed (No changes)');
            }
          });
      })
      .then(() => {
        // Import compression setting if necessary
        if (this.lastPullCompression !== this.compression) {
          logger.log('Updated compression settings change');
          this.compression = this.lastPullCompression;
        }
      })
      .then(() => {
        return this.loadLocalData();
      });
  }

  /**
   * Updates sync interval
   */
  changeSyncRate(minutes) {
    this.syncRate = minutes;
    if (this.syncRate > 35791) {
      // Cap at maximum value
      this.syncRate = 35791;
    }

    clearInterval(this.syncInterval);

    if (this.syncRate > 0) {
      this.syncInterval = setInterval(this.autoSync, this.syncRate * 60 * 1000);
    }
  }

  autoSync() {
    logger.log('Running auto-sync...');
    this.sync()
      .then(() => {
        if (this.onAutoSyncHook) {
          logger.log('Executing auto-sync hook...');
          this.onAutoSyncHook();
        } else {
          logger.log('No auto-sync hook provided');
        }
      });
  }

  /**
   * Updates sync interval
   */
  resetSyncRate() {
    this.changeSyncRate(this.syncRate);  
  }

  /**
   * Overwrites local bookmarks with the ones on the server
   */
 getRemoteData() {
    if (!this.provider.isAuthed()) {
      return Promise.reject('Error during pull, no available access token');
    } else if (!this.getCurrentProfile()) {
      return Promise.reject('Error, a profile must be specified to enable syncing');
    }

    return this.provider.fileDownload({ id: this.getCurrentProfile().id })
      .then((result) => {
        logger.log('File contents!', result);

        this.lastPullCompression = result.compressed ? true : false;

        return result.contents;
      })
      .catch((error) => {
        logger.error(JSON.stringify(error));

        throw error;
      });
  }

}

// Static functions/vars

/**
 * Used for tracking number of bookmarks during tree traversal
 */
BookmarkManager.bookmarkCountBuffer = 0;
BookmarkManager.folderCountBuffer = 0;
BookmarkManager.resetCountBuffers = function () {
  BookmarkManager.bookmarkCountBuffer = 0;
  BookmarkManager.folderCountBuffer = 0;
};

/**
 * Converts a tree of bookmark nodes to JSON
 */
BookmarkManager.treeNodesToJSON = function (node) {
  var data = {};
  data.children = [];
  data.dateAdded = node.dateAdded;
  data.id = node.id;
  data.index = node.index;
  data.title = node.title;
  if (typeof node.dateGroupModified !== 'undefined') {
    data.dateGroupModified = node.dateGroupModified;
  }
  if (typeof node.parentId !== 'undefined') {
    data.parentId = node.parentId;
  }
  if (typeof node.parentId !== 'undefined') {
    data.parentId = node.parentId;
  }
  if (typeof node.type !== 'undefined') {
    data.type = node.type;
  }
  if (typeof node.url !== 'undefined') {
    data.url = node.url;
  }

  outgoingUrlFix(data);

  if (node.children) {
    // This is a folder so we need to find all children
    for (var i = 0; i < node.children.length; i++) {
      // Add the created child to the children list
      data.children.push(BookmarkManager.treeNodesToJSON(node.children[i]));
    }
    BookmarkManager.folderCountBuffer++;
  } else {
    BookmarkManager.bookmarkCountBuffer++;
  }

  return data;
};

/**
 * Searches for a bookmark within bookmark tree by title
 * @param {string} title 
 * @param {BookmarkTreeNode} node 
 */
BookmarkManager.findNodeByTitle = function (title, node, depthLimit) {
  depthLimit = (typeof depthLimit === 'undefined') ? -1 : depthLimit;

  if (node.title && node.title.match(title)) {
    return node; 
  } else if ((depthLimit > 0 || depthLimit === -1) && typeof node.children !== 'undefined') {
    var result = null;
    for (var i = 0; i < node.children.length && !result; i++) {
      result = BookmarkManager.findNodeByTitle(title, node.children[i], depthLimit !== -1 ? depthLimit - 1 : -1);
    }
    return result;
  } else {
    return null;
  }
};

/**
 * Searches for a bookmark within bookmark tree by URL
 * @param {string} url 
 * @param {BookmarkTreeNode} node 
 */
BookmarkManager.findNodeByUrl = function (url, node, depthLimit) {
  depthLimit = (typeof depthLimit === 'undefined') ? -1 : depthLimit;

  if (node.url === url) {
    return node;
  } else if ((depthLimit > 0 || depthLimit === -1) && typeof node.children !== 'undefined') {
    var result = null;
    for (var i = 0; i < node.children.length && !result; i++) {
      result = BookmarkManager.findNodeByUrl(url, node.children[i], depthLimit !== -1 ? depthLimit - 1 : -1);
    }
    return result;
  } else {
    return null;
  }
};

/**
 * Given an out of date local folder VS remote folder, calculate their deltas
 * @param {BookmarkTreeNode} remoteFolder 
 */
BookmarkManager.calculateDeltas = function (localFolder, remoteFolder, deltas) {
  deltas = deltas || [];

  // Deltas only for this depth
  var localDeltas = [];

  var i = 0;
  var j = 0;
  var localIndex = 0;
  var remoteIndex = 0;
  var currentLocalNode;
  var currentRemoteNode;
  var ignoreHash = {};
  var foundItem = false;

  if (!localFolder) {
    // This means the folder does not exist locally (likely an incompatible browser with invalid bookmark structure)
    return deltas;
  }


  // Fix all negative indices from the remote (Force to 0)
  // Note: This is more of a precaution, as there was one instance where a -1 index came in
  for (remoteIndex = 0; remoteIndex < remoteFolder.children.length; remoteIndex++) {
    remoteFolder.children[remoteIndex].index = remoteIndex;
  }
  // Fix all local negative indices (Force to 0)
  // Note: This is more of a precaution, as there was one instance where a -1 index came in
  for (localIndex = 0; localIndex < localFolder.children.length; localIndex++) {
    localFolder.children[localIndex].index = localIndex;
  }

  // For each child node in the remote folder
  for (remoteIndex = 0; remoteIndex < remoteFolder.children.length; remoteIndex++) {
    currentRemoteNode = remoteFolder.children[remoteIndex];
    
    // Search the local folder for another entry of the same identificaton at this depth
    foundItem = false;
    for (localIndex = 0; localIndex < localFolder.children.length && !foundItem; localIndex++) {
      currentLocalNode = localFolder.children[localIndex];

      if (typeof currentRemoteNode.url === 'undefined') {
        // Handle folders
        if (typeof currentLocalNode.url === 'undefined' && currentLocalNode.title === currentRemoteNode.title && !ignoreHash[currentLocalNode.id]) {
          foundItem = true;
          // This folder is the same
          // Don't search for this node again
          ignoreHash[currentLocalNode.id] = true;
          if (currentLocalNode.title !== currentRemoteNode.title) {
            // Use the remote's title
            deltas.push({ type: 'update', node: currentLocalNode, title: currentRemoteNode.title });
            localDeltas.push(deltas[deltas.length - 1]);
          }
          if (currentLocalNode.index !== currentRemoteNode.index) {
            // This folder was moved, add delta to move to the remote's index
            deltas.push({ type: 'move', node: currentLocalNode, index: currentRemoteNode.index });
            localDeltas.push(deltas[deltas.length - 1]);
          }

          // Recurse into this folder to identify deltas
          BookmarkManager.calculateDeltas(currentLocalNode, currentRemoteNode, deltas);
        }
      } else {
        // Handle bookmarks
        if (typeof currentLocalNode.url !== 'undefined' && currentLocalNode.url === currentRemoteNode.url && !ignoreHash[currentLocalNode.id]) {
          foundItem = true;
          // This bookmark is the same url
          // Don't search for this node again
          ignoreHash[currentLocalNode.id] = true;
          if (currentLocalNode.title !== currentRemoteNode.title) {
            // Use the remote's title
            deltas.push({ type: 'update', node: currentLocalNode, title: currentRemoteNode.title });
            localDeltas.push(deltas[deltas.length - 1]);
          }
          if (currentLocalNode.index !== currentRemoteNode.index) {
            // This folder was moved, add delta to move to the remote's index
            deltas.push({ type: 'move', node: currentLocalNode, index: currentRemoteNode.index });
            localDeltas.push(deltas[deltas.length - 1]);
          }
        }
      }
    }

    if (!foundItem) {
      // The node from the remote was not found locally, must add a new node
      deltas.push({ type: 'create', node: currentRemoteNode, parentId: localFolder.id, index: currentRemoteNode.index });
      localDeltas.push(deltas[deltas.length - 1]);
    }
  }

  // See which nodes that we didn't acknowledge in the local data to mark for deletion
  for (localIndex = 0; localIndex < localFolder.children.length; localIndex++) {
    currentLocalNode = localFolder.children[localIndex];

    if (!ignoreHash[currentLocalNode.id]) {
      // This node existed locally but not in the remote, must mark for deletion
      deltas.push({ type: 'delete', node: currentLocalNode });
      localDeltas.push(deltas[deltas.length - 1]);
    }
  }

  return deltas;
};

/**
 * Helper function for recursively creating bookmark children
 */
BookmarkManager.applyDeltaCreateHelper = function (node, parentNode) {
  var bookmark = {};
  bookmark.title = node.title;
  bookmark.index = Math.max(0, node.index);
  bookmark.parentId = parentNode.id;
  if (node.url) {
    bookmark.url = node.url;
  }

  return browser.bookmarks.create(bookmark)
    .catch((e) => {
      // Something went wrong, attempt to fix
      return incomingUrlFixer(bookmark, node);
    })
    .then((createdNode) => {
      // Recursively create children 
      return Promise_each(node.children, (child) => {
        return BookmarkManager.applyDeltaCreateHelper(child, createdNode);
      });
    });
};


/**
 * Given a modified BookmarkTree, applies those changes while walking the existing tree
 * @param {BookmarkTreeNode} localFolder 
 * @param {BookmarkTreeNode} remoteFolder 
 */
BookmarkManager.applyDelta = function (delta) {
  if (delta.type === 'create') {
    var bookmark = {};
    bookmark.title = delta.node.title;
    bookmark.index = delta.index;
    bookmark.parentId = delta.parentId;
    if (delta.node.url) {
      bookmark.url = delta.node.url;
    }
    return browser.bookmarks.create(bookmark)
      .catch((e) => {
        // Something went wrong, attempt to fix
        return incomingUrlFixer(bookmark, delta.node);
      })
      .then((node) => {
        // Recursively create children
        return Promise_each(delta.node.children, (child) => {
          return BookmarkManager.applyDeltaCreateHelper(child, node);
        });
      });
  } else if (delta.type === 'delete') {
    // Recursively delete children
    return Promise_each(delta.node.children, (child) => {
      return BookmarkManager.applyDeltaDeleteHelper(child);
    })
      .then(() => {
        // Now we can delete self
        if (delta.node.type === 'folder') {
          // More Efficient removal for folders
          return browser.bookmarks.removeTree(delta.node.id);
        } else {
          return browser.bookmarks.remove(delta.node.id);
        }
      });
  } else if (delta.type === 'move') {
    return browser.bookmarks.move(delta.node.id, { index: Math.max(0, delta.index) });
  } else if (delta.type === 'update') {
    return browser.bookmarks.update(delta.node.id, { title: delta.title });
  }
};

/**
 * Helper function for recursively deleting bookmark children
 */
BookmarkManager.applyDeltaDeleteHelper = function (node) {
  // Recursively delete children 
  return Promise_each(node.children, (child) => {
    return BookmarkManager.applyDeltaDeleteHelper(child);
  })
    .then(() => {
      // Now safe to delete self
      if (node.type === 'folder') {
        // More Efficient removal for folders
        return browser.bookmarks.removeTree(node.id);
      } else {
        return browser.bookmarks.remove(node.id);
      }
    });
};
