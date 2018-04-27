import React from 'react';
import Logger from 'logger';
import Error from 'views/components/Error';

var logger = new Logger('[Home.jsx] ');

export default class Home extends React.Component {
  constructor() {
    super();

    this.state = {
    };
  }

  sync(evt) {
    logger.log("Sync clicked");
    browser.runtime.sendMessage({ action: 'sync' });
  }
  render() {
    return (
      <div className="Home">
        <h5 className="mb-2">Home</h5>
        <button id="sync" className="btn btn-outline-info" type="button" onClick={(evt) => { this.sync(evt); }}>Sync Now</button>
        <Error message={this.props.params.errors[0] || ''}/>
      </div>
    );
  }
}
