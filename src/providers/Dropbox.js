import Logger from 'util/Logger';
import { default as StorageProvider, StorageProviderError } from 'providers/StorageProvider';
import * as _ from 'lodash';
import * as axios from 'axios';
import * as DropboxCls from 'dropbox';

var logger = new Logger('[Dropbox.js]');

export default class Dropbox extends StorageProvider {

  constructor() {
    super();

    this.dbauth = new DropboxCls.DropboxAuth({ clientId: '1ea74e9vcsu22oz' });
    this.db = null;
  }

  getType() {
    return 'dropbox';
  }
  getCredentials() {
    return this.dbauth.getAccessToken() ? { accessToken: this.dbauth.getAccessToken(), refreshToken: this.dbauth.getRefreshToken() } : null;
  }
  isAuthed() {
    return this.dbauth.getAccessToken() ? true : false;  
  }
  authorize(credentials) {
    this.dbauth.setAccessToken(credentials ? credentials.accessToken : null);
    this.dbauth.setRefreshToken(credentials ? credentials.refreshToken : null);
    this.db = new DropboxCls.Dropbox({ accessToken: this.dbauth.getAccessToken() });

    return Promise.resolve()
      .then(() => {
        if (credentials && !credentials.refreshToken) {
          throw new StorageProviderError('Invalid refresh token, please try reconnecting to Dropbox');
        } else {
          return this.checkRefreshToken();
        }
      })
      .catch((err) => {
        // Special error handling can go here
        throw err;
      });
  }
  deauthorize() {
    return this.db.authTokenRevoke();
  }
  
  checkRefreshToken() {
    logger.log('Verifying access token...');

    var previousAccessToken = this.dbauth.getAccessToken();

    return this.db.filesListFolder({path: ''})
      .catch((error) => {
        logger.log('Access token expired. Attempting to fetch new token...');
        
        // Token invalid, get new refresh token
        return axios({
          method: 'post',
          url: PRODUCTION ? 'https://syncmarx.com/auth/dropbox/refreshtoken' : 'http://localhost:1800/auth/dropbox/refreshtoken',
          params: {
            refresh_token: this.dbauth.getRefreshToken()
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        })
          .then((response) => {
            this.dbauth.setAccessToken(response.data.access_token);
            this.db = new DropboxCls.Dropbox({ accessToken: this.dbauth.getAccessToken() });
            logger.log('Obtained new access token!');
          });
      })
      .catch((error) => {
        // Assume that the token expired
        logger.error('Problem checking token', error);
        // Pass error along
        throw error;
      });
  }
  filesList() {
    return this.checkRefreshToken()
      .then(() => {
        return this.db.filesListFolder({path: ''});
      })
      .then((response) => {
        logger.log("Data retrieved successfully - Dropbox Folder Contents: " , response.result.entries);

        // TODO: Make sure this still works (was returning the not formatted data before)
        return _.map(response.result.entries, (file) => {
          return {
            id: file.path_lower,
            name: file.name.replace(/\.(.*?)$/g, '')
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
    var file = new File([encryptedData], data.fileName);

    return this.checkRefreshToken()
      .then(() => {
        // Note: Dropbox uses file paths rather than ID to upload/update files. So file conflict check is not needed
        return this.db.filesUpload({path: '/' + data.fileName, contents: file, mode: 'overwrite' });
      })
      .then((response) => {
        logger.log('File uploaded!', response);
      });
  }
  fileDownload(data) {
    return this.checkRefreshToken()
      .then(() => {
        return this.db.filesDownload({path: data.id });
      })
      .then((response) => {
        logger.log('File downloaded!', response.result);

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
          reader.readAsText(response.result.fileBlob);
        });
      });
  }
}
