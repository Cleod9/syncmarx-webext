import React from 'react';
import Logger from 'util/Logger';

var Dropbox = require('dropbox').Dropbox;


var logger = new Logger('[Authentication.jsx]');

export default class Authentication extends React.Component {
  constructor() {
    super();

    this.state = {
    };
  }

  auth(evt) {
    logger.log("Auth clicked");
    if (this.props.onAuth) {
      let value = this.refs.provider.value;

      if (value === 'dropbox') {
        this.props.onAuth({ provider: 'dropbox', credentials: { accessToken: this.refs.codeText.value } });
      } else {
        let tokenList = this.refs.codeText.value.split(':');
        let accessToken = tokenList[0];
        let refreshToken = tokenList[1];
        this.props.onAuth({ provider: 'googledrive', credentials: { accessToken: accessToken, refreshToken: refreshToken } });
      }
    }
  }
  link(evt) {
    logger.log("Selected provider", this.refs.provider.value);

    let value = this.refs.provider.value;

    if (value === 'dropbox') {
      let dbx = new Dropbox({ clientId: '1ea74e9vcsu22oz' });
      let authUrl = dbx.getAuthenticationUrl("https://syncmarx.gregmcleod.com/auth/dropbox", null, 'code');
      window.open(authUrl);
    } else if (value === 'googledrive') {
      let scope = 'https://www.googleapis.com/auth/drive.appdata';
      let client_id = '230145339685-4smjsndovcf1l9ohdh59bl52pgvgmnga';
      //let redirect_uri = 'https://syncmarx.gregmcleod.com/auth/googledrive';
      let redirect_uri = 'http://localhost:1800/auth/googledrive';
      let authUrl = `https://accounts.google.com/o/oauth2/v2/auth?scope=${scope}&response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&prompt=consent&access_type=offline`;

      window.open(authUrl);
    }
  }
  render() {
    return (
      <div className="Authentication">
        <h5 className="mb-3">Setup</h5>
        <div className="mb-3">
          <h6><strong>Choose a Service Provider:</strong></h6>
          <select ref="provider">
            <option value="dropbox">Dropbox</option>
            <option value="googledrive">Google Drive</option>
          </select> <button id="link" className="btn btn-info btn-sm" onClick={(evt) => { this.link(evt); }}>Get Token</button>
        </div>
        <div className="input-group mb-4">
          <input className="form-control" ref="codeText" type="text" placeholder="Paste Token Here"/> 
          <button id="auth" type="button" className="btn btn-primary btn-sm input-group-addon" onClick={(evt) => { this.auth(evt); }}>Authorize</button>
        </div>
        <div className="alert alert-warning" role="alert">
          <p><strong>Warning:<br/>This extension is in alpha!</strong></p>
          <p>Please make a manual backup your bookmarks before use to avoid the risk of losing bookmarks!</p>
        </div>
      </div>
    );
  }
}
