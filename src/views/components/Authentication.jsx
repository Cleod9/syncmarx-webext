import React from 'react';
import Logger from 'util/Logger';
import Error from 'views/components/Error';

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
      this.props.onAuth({ provider: 'dropbox', credentials: { accessToken: this.refs.codeText.value } });
    }
  }
  link(evt) {
    logger.log("Link clicked");
    var dbx = new Dropbox({ clientId: '1ea74e9vcsu22oz' });
    var authUrl = dbx.getAuthenticationUrl("https://syncmarx.mcleodgaming.com/auth/dropbox", null, 'code');
    window.open(authUrl);
  }
  render() {
    return (
      <div className="Authentication">
        <h5 className="mb-3">Setup</h5>
        <div className="mb-3">
          <button id="link" className="btn btn-info btn-sm" onClick={(evt) => { this.link(evt); }}>Link With Dropbox</button>
        </div>
        <div className="input-group">
          <input className="form-control" ref="codeText" type="text" placeholder="Paste Token Here"/> 
          <button id="auth" type="button" className="btn btn-primary btn-sm input-group-addon" onClick={(evt) => { this.auth(evt); }}>Authorize</button>
          <Error message={this.props.params.errors[0] || ''}/>
        </div>
      </div>
    );
  }
}
