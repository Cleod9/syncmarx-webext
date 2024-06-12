import Logger from 'util/Logger';
import StorageProvider from 'providers/StorageProvider';
import * as _ from 'lodash';

var BoxSdk = require('box-javascript-sdk').default;
var logger = new Logger('[Box.js]');

export default class Box extends StorageProvider {

  constructor() {
    super();
    
    this.accessToken = null;
    this.refreshToken = null;
    this.client = null;

    this.box = new BoxSdk();
  }
  getType() {
    return 'box';
  }
  getCredentials() {
    return this.accessToken ? { accessToken: this.accessToken, refreshToken: this.refreshToken } : null;
  }
  isAuthed() {
    return this.accessToken ? true : false;  
  }
  authorize(credentials) {
    this.accessToken = credentials.accessToken;
    this.refreshToken = credentials.refreshToken;
    this.client = new this.box.BasicBoxClient({accessToken: this.accessToken });


    return this.checkRefreshToken()
      .catch((err) => {
        // Special error handling can go here
        throw err;
      });
  }
  deauthorize() {
    if (this.isAuthed()) {
      const url = PRODUCTION ? 'https://syncmarx.com/auth/box/revoke' : 'http://localhost:1800/auth/box/revoke';
      const params = new URLSearchParams({ access_token: this.accessToken });

      return fetch(`${url}?${params}`, {
        method: 'POST',
      })
      .then(() => {
        this.accessToken = null;
        this.refreshToken = null;
        this.client = null;
      });
    } else {
      return Promise.resolve();
    }
  }
  checkRefreshToken() {
    logger.log('Verifying access token...');

    return this.client.folders.get({ id: '0' })
      .catch((error) => {
        // Assume that the token expired
        if (error.response && error.response.status === 401) {
          logger.log('Access token expired. Attempting to fetch new token...');
          
          // Token invalid, get new refresh token
          const url = PRODUCTION ? 'https://syncmarx.com/auth/box/refreshtoken' : 'http://localhost:1800/auth/box/refreshtoken';
          const params = new URLSearchParams({ refresh_token: this.refreshToken });

          return fetch(`${url}?${params}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          })
          .then(response => response.json())
          .then(data => {
            this.accessToken = data.access_token;
            this.refreshToken = data.refresh_token;
            this.client = new this.box.BasicBoxClient({accessToken: this.accessToken });

            logger.log('Obtained new token!');

            return data;
          });
        } else {
          logger.error('Problem checking token', error);
          // Pass error along
          throw error;
        }
      })
      .then((response) => {
        if (response) {
          logger.log('Token is valid');
        } else {
          throw new Error('No response from provider');
        }
      });
  }
  getOrCreateAppFolder() {
    // Make sure a folder exists on Box to place data
    return this.checkRefreshToken()
      .then(() => {
        return this.client.folders.get({ id: '0' });
      })
      .then((response) => {
          // Extract folders from list
          let appFolder = _.find(response.item_collection.entries, (item) => {
            return item.name === 'syncmarx';
          });

          if (appFolder) {
            logger.log('App folder found:', appFolder);
            return this.client.folders.get({ id: appFolder.id });
          } else {
            logger.log('App folder not found, creating new one...');

            this.client.folders.create({ parent: { id: '0' }, name: 'syncmarx' })
              .then((folder) => {
                logger.log('Created app folder:', folder)
                return folder;
              });
          }
        });
  }
  filesList() {
    return this.checkRefreshToken()
      .then(() => {
         return this.getOrCreateAppFolder()
      })
      .then((folder) => {
        logger.log('Listing files:', folder);

        // Extract files from list
        let filesFound = _.filter(folder.item_collection.entries, (file) => {
          return file.type === 'file';
        });

        // Return the files in usable format
        return _.map(filesFound, (file) => {
          return {
            id: file.id,
            name: file.name.replace(/\.(.*?)$/g, '')
          };
        });
      });
  }
  fileUpload(data) {
    return this.checkRefreshToken()
      .then(() => {
        return this.getOrCreateAppFolder()
      })
      .then((folder) => {
        // See if a file exists with this file name already
        var existingFile = null;
        
        if (!data.id && !data.fileName) {
          throw new Error('Error, profile id and file name were not specified');
        } else {
          // Find by id or name
          existingFile = _.find(folder.item_collection.entries, (f) => f.id === data.id || f.name === data.fileName);
        }

        var fileName = (existingFile) ? existingFile.name : data.fileName;

        // Encrypt and compress
        var encryptedData = (data.compression) ? this.encryptData(data.contents) : JSON.stringify(data.contents, null, 2);
        var file = new File([encryptedData], fileName);

        var formData = new FormData();
      
        formData.append(file.name, file);
        formData.append('parent_id', folder.id);

        if (existingFile) {
          formData.append('file_id', existingFile.id);
          // Update file
          return this.client.files.uploadNewFileVersion({ body: formData }); 
        } else {
          // Upload new file
          return this.client.files.upload({ body: formData });   
        }
      })
      .then((file) => {
        logger.log('upload success', file);
      });
  }
  fileDownload(data) {
    return this.checkRefreshToken()
      .then(() => {

        return this.filesList()
          .then((files) => {
            let existingFile = _.find(files, (f) => f.id === data.id);
              
            // Intitiate the download
            return fetch('https://api.box.com/2.0/files/' + existingFile.id + '/content', {
              method: 'GET',
              headers: {
                'Authorization': 'Bearer ' + this.accessToken,
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            });
          });
      })
      .then(response => response.text())
      .then((data) => {
        logger.log('File downloaded!', data);

        // Decompress and decrypt
        var contents = null;
        var compressed = false;

        try {
          contents = JSON.parse(data);
        } catch(e) {
          contents = this.decryptData(data);
          compressed = true;
        }

        return { contents: contents, compressed: compressed };
      });
  }
}
