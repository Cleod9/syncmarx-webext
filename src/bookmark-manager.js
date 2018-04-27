require('isomorphic-fetch');
require('es6-promise').polyfill();
var _ = require('lodash');
var Dropbox = require('dropbox').Dropbox;
var LZString = require('lz-string');
var Cryptr = require('cryptr');
import Logger from 'logger';

var logger = new Logger('[bookmark-manager.js] ');
var detect = require('detect-browser').detect;
var BROWSER_NAME = detect().name;

// Secret string
var secretKey = 'GYYw7AHADAJsUFoBMFgEMEBYCMmCcCARgGwCsxCo2AzLDKdnmIUAAA==';

var DATA_VERSION = 1; // Versioning for bookmarks data

// Browser-specific names for root folders
var TOOLBAR_TITLES = /^(Bookmarks Toolbar)|(Bookmarks bar)$/g;
var MENU_TITLES = /^(Bookmarks Menu)|(Other bookmarks)$/g;

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


var cryptr = new Cryptr(LZString.decompressFromBase64(secretKey));

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

export default class BookmarkManager {
  constructor() {
    this.sync = this.sync.bind(this);
  
    this.init();
  }
  
  /**
   * Resets manager
   */
 init() {
    this.dbx = new Dropbox({ clientId: '1ea74e9vcsu22oz' });
    this.data = null;
    this.profilePath = '';
    this.storageProvider = 'dropbox';
    this.lastSyncTime = 0;
    this.syncRate = 15; // Default to 15 minutes
    this.syncInterval = 0;
    this.localData = null; // { lastModified:number; DATA_VERSION: 1, data:BookmarkTreeNode}
    clearInterval(this.syncInterval);

    this.resetSyncRate();
  }

  /**
   * Loads local bookmark data into the manager
   */
 loadLocalData() {
    return browser.bookmarks.getTree()
      .then((bookmarks) => {
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
   * @param {string} accessToken 
   */
 auth(accessToken, storageProvider) {
    logger.log("Start auth");
    if (!accessToken) {
      return Promise.reject('Error, no access token provided');
    }
    this.storageProvider = 'dropbox';
    this.dbx.setAccessToken(accessToken);

    return this.getProfiles();
  }

  /**
   * Sets acces token for authoriation and performs a test operation via getProfiles()
   * @param {string} accessToken 
   */
  revokeAuth() {
    logger.log("Revoke auth");
    if (!this.dbx.getAccessToken()) {
      return Promise.reject('Error, no token to be revoked');
    }

    return this.dbx.authTokenRevoke();
  }
  
  /**
   * Retrieves bookmark profiles saved under the syncmarx app folder
   */
 getProfiles() {
    if (!this.dbx.getAccessToken()) {
      return Promise.reject('Error cannot retrieve bookmark data, no access token provided');
    }
    
    return this.dbx.filesListFolder({path: ''})
      .then((response) => {
        logger.log("Data retrieved successfully - DropBox Folder Contents: " , response.entries);

        this.profiles = response.entries;

        return response.entries;
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
    if (!this.dbx.getAccessToken()) {
      return Promise.reject('Error during push, no available access token');
    } else if (!this.profilePath) {
      return Promise.reject('Error, a profile must be specified to enable syncing');
    }

    return this.loadLocalData()
      .then(() => {
        this.localData.lastModified = new Date().getTime();

        // Encrypt and compress
        var encryptedData = cryptr.encrypt(LZString.compressToBase64(JSON.stringify(this.localData)));
      
        var file = new File([encryptedData], this.profilePath.replace(/^\//g, ''));
      
        return this.dbx.filesUpload({path: this.profilePath, contents: file, mode: 'overwrite' })
          .then((response) =>  {
            this.lastSyncTime = this.localData.lastModified;
            logger.log('File uploaded!', response);
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
    if (!this.dbx.getAccessToken()) {
      return Promise.reject('Error during pull, no available access token');
    } else if (!this.profilePath) {
      return Promise.reject('Error, a profile must be specified to enable syncing');
    }

    return this.getRemoteData(this.profilePath)
      .then((results) => {
        return this.loadLocalData()
          .then(() =>  {
            // Get local data
            var localToolbarData = BookmarkManager.findNodeByTitle(TOOLBAR_TITLES, this.localData.data, 1);
            var localMenuData = BookmarkManager.findNodeByTitle(MENU_TITLES, this.localData.data, 1);

            // Recursively delete children 
            return Promise_each(localToolbarData.children, (child) => {
              return BookmarkManager.applyDeltaDeleteHelper(child);
            })
              .then(() => {
                return Promise_each(localMenuData.children, (child) => {
                  return BookmarkManager.applyDeltaDeleteHelper(child);
                })
                  .then(() => {
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
    
    if (!this.dbx.getAccessToken()) {
      return Promise.reject('Error during sync, no available access token');
    } else if (!this.profilePath) {
      return Promise.reject('Error, a profile must be specified to enable syncing');
    }

    return this.loadLocalData()
      .then(() => {
        // Get local data
        var localToolbarData = BookmarkManager.findNodeByTitle(TOOLBAR_TITLES, this.localData.data, 1);
        var localMenuData = BookmarkManager.findNodeByTitle(MENU_TITLES, this.localData.data, 1);

        return this.getRemoteData()
          .then((remoteData) => {
            var remoteToolbarData = BookmarkManager.findNodeByTitle(TOOLBAR_TITLES, remoteData.data, 1);
            var remoteMenuData = BookmarkManager.findNodeByTitle(MENU_TITLES, remoteData.data, 1);

            // Check for deltas between local and remote
            var toolbarDeltas = BookmarkManager.calculateDeltas(localToolbarData, remoteToolbarData);
            var menuDeltas = BookmarkManager.calculateDeltas(localMenuData, remoteMenuData);

            logger.info('toolbar deltas:', toolbarDeltas);
            logger.info('menu deltas:', menuDeltas);
            
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
                      logger.log('Sync completed (Merged with changes)');
                      return this.push();
                  });
              }
            } else {
              logger.log('Sync completed (No changes)');
            }
          });
      });
  }

  /**
   * Updates sync interval
   */
  changeSyncRate(minutes) {
    this.syncRate = minutes;

    clearInterval(this.syncInterval);
    this.syncInterval = setInterval(this.sync, this.syncRate * 60 * 1000);
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
    if (!this.dbx.getAccessToken()) {
      return Promise.reject('Error during pull, no available access token');
    } else if (!this.profilePath) {
      return Promise.reject('Error, a profile must be specified to enable syncing');
    }

    return this.dbx.filesDownload({path: this.profilePath })
      .then((response) => {
        logger.log('File downloaded!', response);

        return new Promise((resolve, reject) => {
          var reader = new FileReader();
          reader.onload = () => {
              // Decompress and decrypt
              var decryptedData = JSON.parse(LZString.decompressFromBase64(cryptr.decrypt(reader.result)));

              resolve(decryptedData);
          };
          reader.onerror = (e) => {
            reject(e);
          };
          reader.readAsText(response.fileBlob);
        });
      })
      .then((result) => {
        logger.log('File contents!', result);

        return result;
      })
      .catch((error) => {
        logger.error(JSON.stringify(error));

        throw error;
      });
  }

}

// Static functions

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

  if (node.children) {
    // This is a folder so we need to find all children
    for (var i = 0; i < node.children.length; i++) {
      // Add the created child to the children list
      data.children.push(BookmarkManager.treeNodesToJSON(node.children[i]));
    }
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
        return browser.bookmarks.remove(delta.node.id);
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
      return browser.bookmarks.remove(node.id);
    });
};
