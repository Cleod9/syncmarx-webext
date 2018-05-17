import Logger from 'util/Logger';
import StorageProvider from 'providers/StorageProvider';

var DropboxCls = require('dropbox').Dropbox;
var logger = new Logger('[Dropbox.js]');

export default class Dropbox extends StorageProvider {

  constructor(params) {
    super(params);

    this.dbx = new DropboxCls({ clientId: '1ea74e9vcsu22oz' });
  }

  getType() {
    return 'dropbox';
  }
  isAuthed() {
    return this.dbx.getAccessToken() ? true : false;  
  }
  setParams(params) {
    super.setParams(params);
  }
  authorize() {
    this.dbx.setAccessToken(this.params.credentials ? this.params.credentials.accessToken : null);

    return Promise.resolve();
  }
  deauthorize() {
    return this.dbx.authTokenRevoke();
  }
  filesList(path) {
    return this.dbx.filesListFolder({path: path})
      .then((response) => {
        logger.log("Data retrieved successfully - DropBox Folder Contents: " , response.entries);

        this.profiles = response.entries;

        return response.entries;
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
