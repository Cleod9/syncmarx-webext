import Logger from 'util/Logger';

var LZString = require('lz-string');
var Cryptr = require('cryptr');

var logger = new Logger('[StorageProvider.js]');

// Secret string
// TODO: This pattern could be used to password-protect files as a new feature. For now it is just be using to compress and obfuscate the data.
var secretKey = 'GYYw7AHADAJsUFoBMFgEMEBYCMmCcCARgGwCsxCo2AzLDKdnmIUAAA==';

var cryptr = new Cryptr(LZString.decompressFromBase64(secretKey));

/**
 * To help capture user-friendly error messaging
 */
export class StorageProviderError extends Error {
  constructor(message) {
    super(message);
  }
}


export default class StorageProvider {

  constructor() {
  }

  getType() {
    return 'storageProvider';
  }
  getCredentials() {
    return null;
  }
  isAuthed() {
    logger.warn('Warning, must override StorageProvider isAuthed() function');
    return true;  
  }
  authorize(credentials) {
    logger.warn('Warning, must override StorageProvider authorize() function');

    return Promise.resolve();
  }
  deauthorize() {
    logger.warn('Warning, must override StorageProvider deauthorize() function');

    return Promise.resolve();
  }
  filesList() {
    logger.warn('Warning, must override StorageProvider filesList() function');

    return Promise.resolve([]);
  }
  fileUpload(data) {
    logger.warn('Warning, must override StorageProvider fileUpload() function');

    return Promise.resolve();
  }
  fileDownload(data) {
    logger.warn('Warning, must override StorageProvider fileDownload() function');

    return Promise.resolve();
  }
  encryptData(contents) {
    return cryptr.encrypt(LZString.compressToBase64(JSON.stringify(contents)));
  }
  decryptData(contents) {
    return JSON.parse(LZString.decompressFromBase64(cryptr.decrypt(contents)));
  }
}
