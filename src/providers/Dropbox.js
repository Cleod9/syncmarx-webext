import Logger from 'util/Logger';
import StorageProvider from 'providers/StorageProvider';
import * as _ from 'lodash';

var DropboxCls = require('dropbox').Dropbox;
var logger = new Logger('[Dropbox.js]');

export default class Dropbox extends StorageProvider {

  constructor() {
    super();

    this.dbx = new DropboxCls({ clientId: '1ea74e9vcsu22oz' });
  }

  getType() {
    return 'dropbox';
  }
  getCredentials() {
    return this.dbx.getAccessToken() ? { accessToken: this.dbx.getAccessToken() } : null;
  }
  isAuthed() {
    return this.dbx.getAccessToken() ? true : false;  
  }
  authorize(credentials) {
    this.dbx.setAccessToken(credentials ? credentials.accessToken : null);

    return Promise.resolve();
  }
  deauthorize() {
    return this.dbx.authTokenRevoke();
  }
  filesList() {
    return this.dbx.filesListFolder({path: ''})
      .then((response) => {
        logger.log("Data retrieved successfully - DropBox Folder Contents: " , response.entries);

        // TODO: Make sure this still works (was returning the not formatted data before)
        return _.map(response.entries, (file) => {
          return {
            id: file.id,
            name: file.name,
            path_lower: file.path_lower, // TODO: Remove need for this and just use 'id' field
            path_display: file.path_display
          };
        });
      })
      .catch((error) => {
        if (error && typeof error.error === 'string' && error.error.match(/malformed/g)) {
          throw 'Auth token is malformed';
        } else if (error && typeof error.error === 'object' && typeof error.error.error === 'object' && error.error.error['.tag'] === "invalid_access_token") {
          throw 'Invalid authorization token';
        }
        throw error;
      });
  }
  fileUpload(data) {
    // Encrypt and compress
    var encryptedData = (data.compression) ? this.encryptData(data.contents) : JSON.stringify(data.contents, null, 2);
  
    var file = new File([encryptedData], data.path.replace(/^\//g, ''));
  
    return this.dbx.filesUpload({path: data.path, contents: file, mode: 'overwrite' })
      .then((response) => {
        logger.log('File uploaded!', response);
      });
  }
  fileDownload(data) {
    return this.dbx.filesDownload({path: data.path })
      .then((response) => {
        logger.log('File downloaded!', response);

        return new Promise((resolve, reject) => {
          var reader = new FileReader();
          reader.onload = () => {
              // Decompress and decrypt
              var contents = null;
              var compressed = false;

              try {
                contents = JSON.parse(reader.result);
              } catch(e) {
                contents = this.decryptData(reader.result);
                compressed = true;
              }

              resolve({ contents: contents, compressed: compressed });
          };
          reader.onerror = (e) => {
            reject(e);
          };
          reader.readAsText(response.fileBlob);
        });
      });
  }
}
