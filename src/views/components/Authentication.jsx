import React from 'react';
import Logger from 'util/Logger';
import * as DropboxCls from 'dropbox';


var logger = new Logger('[Authentication.jsx]');

/**
 * The "Setup" screen
 */
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
        let tokenList = this.refs.codeText.value.split(':');
        let accessToken = tokenList[0];
        let refreshToken = tokenList[1];
        this.props.onAuth({ provider: 'dropbox', credentials: { accessToken: accessToken, refreshToken: refreshToken } });
      } else if (value === 'googledrive') {
        let tokenList = this.refs.codeText.value.split(':');
        let accessToken = tokenList[0];
        let refreshToken = tokenList[1];
        this.props.onAuth({ provider: 'googledrive', credentials: { accessToken: accessToken, refreshToken: refreshToken } });
      } else if (value === 'box') {
        let tokenList = this.refs.codeText.value.split(':');
        let accessToken = tokenList[0];
        let refreshToken = tokenList[1];
        this.props.onAuth({ provider: 'box', credentials: { accessToken: accessToken, refreshToken: refreshToken } });
      }
    }
  }
  onProviderDropdownChanged(evt) {
    logger.log("Selected provider", this.refs.provider.value);

    this.props.onProviderDropdownChanged({ providerDropdown: this.refs.provider.value });
  }
  link(evt) {
    logger.log("Retrieving token for provider", this.refs.provider.value);

    let value = this.refs.provider.value;

    if (value === 'dropbox') {
      let dbx = new DropboxCls.DropboxAuth({ clientId: '1ea74e9vcsu22oz' });
      let redirect_uri = PRODUCTION ? 'https://syncmarx.com/auth/dropbox' : 'http://localhost:1800/auth/dropbox';
      dbx.getAuthenticationUrl(redirect_uri, null, 'code', 'offline', null, 'none', false)
        .then((authUrl) => {
          window.open(authUrl);
        })
        .catch((e) => {
          logger.error(e);
        });
    } else if (value === 'googledrive') {
      let scope = 'https://www.googleapis.com/auth/drive.file';
      let client_id = '230145339685-4smjsndovcf1l9ohdh59bl52pgvgmnga';
      let redirect_uri = PRODUCTION ? 'https://syncmarx.com/auth/googledrive' : 'http://localhost:1800/auth/googledrive';
      let authUrl = `https://accounts.google.com/o/oauth2/v2/auth?scope=${scope}&response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&prompt=consent&access_type=offline`;

      window.open(authUrl);
    } else if (value === 'box') {
      let client_id = PRODUCTION ? 'rjgyteu1uzgjmxpe34x5pj6fw0ndyzy5' : '1j91a6cw6wb2g71venpu6s1fgectc4wr';
      let redirect_uri = PRODUCTION ? 'https://syncmarx.com/auth/box' : 'http://localhost:1800/auth/box';
      let security_key = '00aed913eeff4bd7a72565c0a5594b6a';
      let authUrl = `https://account.box.com/api/oauth2/authorize?response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&state=${security_key}`;

      window.open(authUrl);
    }
  }
  render() {
    return (
      <div className="Authentication">
        <h5 className="mb-3">Setup</h5>
        <div className="mb-3">
          <h6><strong>Choose a Service Provider:</strong></h6>
          <select ref="provider" defaultValue={this.props.params.providerDropdown} onChange={(evt) => {this.onProviderDropdownChanged(evt) }}>
            <option value="dropbox">Dropbox</option>
            <option value="googledrive">Google Drive</option>
            <option value="box">Box</option>
          </select> <button id="link" className="btn btn-info btn-sm" onClick={(evt) => { this.link(evt); }}>Get Token</button>
        </div>
        <div className="input-group mb-4">
          <input className="form-control" ref="codeText" type="text" placeholder="Paste Token Here"/> 
          <button id="auth" type="button" className="btn btn-primary btn-sm input-group-addon" onClick={(evt) => { this.auth(evt); }}>Authorize</button>
        </div>
        <div className="alert alert-warning small" role="alert">
          <p><strong>Warning:<br/>This extension is in alpha!</strong></p>
          <p>Please make a manual backup your bookmarks before use to avoid the risk of losing bookmarks!</p>
        </div>
      </div>
    );
  }
}
