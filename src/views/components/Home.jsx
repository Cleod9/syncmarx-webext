import React from 'react';
import Logger from 'logger';
import Error from 'views/components/Error';
import * as _ from 'lodash';
import * as moment from 'moment';

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
        {(() => {
          if (this.props.params.selectedProfile) {
            // Display selected profile
            let profile = _.find(this.props.params.profiles, (profile, index) => {
              return (profile.path_lower === this.props.params.selectedProfile);
            });
            if (profile) {
              return (
                <p className="small mb-0"><strong>Profile:</strong> {profile.name.replace(/\.syncmarx/g, '')}</p>
              );
            }
          } else {
            <p className="small mb-0">No profiles configured.</p>
          }
        })()}
        {(() => {
          if (this.props.params.selectedProfile) {
            return (
              <div>
                <p className="small mb-0"><strong>Total Folders:</strong> {this.props.params.totalFolders}</p>
                <p className="small mb-0"><strong>Total Bookmarks:</strong> {this.props.params.totalBookmarks}</p>
                <p className="small"><strong>Last Sync:</strong> {moment(new Date(this.props.params.lastSyncTime)).format('YYYY-MM-DD HH:mm:ss')}</p>
                <button id="sync" className="btn btn-outline-info" type="button" onClick={(evt) => { this.sync(evt); }}>Sync Now</button>
              </div>
            );
          }
        })()}
        <Error message={this.props.params.errors[0] || ''}/>
      </div>
    );
  }
}
