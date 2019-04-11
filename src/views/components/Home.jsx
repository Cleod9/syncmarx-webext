import React from 'react';
import Logger from 'util/Logger';
import * as _ from 'lodash';
import * as moment from 'moment';

var logger = new Logger('[Home.jsx]');

export default class Home extends React.Component {
  constructor() {
    super();

    this.state = {
    };
  }

  sync(evt) {
    logger.log("Sync clicked");
    if (this.props.onSync) {
      this.props.onSync();
    }
  }
  render() {
    var lastSyncText = this.props.params.lastSyncTime ? moment(new Date(this.props.params.lastSyncTime)).format('YYYY-MM-DD HH:mm:ss') : '[None]';
    return (
      <div className="Home">
        <h5 className="mb-2">Home</h5>
        {(() => {
          if (this.props.params.selectedProfile) {
            // Display selected profile
            let profile = _.find(this.props.params.profiles, (profile, index) => {
              return (profile.id === this.props.params.selectedProfile.id);
            });
            if (profile) {
              return (
                <p className="small mb-0"><strong>Profile:</strong> {profile.name.replace(/\.syncmarx/g, '')}</p>
              );
            }
          } else {
            return (
              <p className="small mb-0">No profile selected.</p>
            );
          }
        })()}
        {(() => {
          if (this.props.params.selectedProfile) {
            return (
              <div>
                <p className="small mb-0"><strong>Total Folders:</strong> {this.props.params.totalFolders}</p>
                <p className="small mb-0"><strong>Total Bookmarks:</strong> {this.props.params.totalBookmarks}</p>
                <p className="small"><strong>Last Sync:</strong> {lastSyncText}</p>
                <button id="sync" className="btn btn-outline-info" type="button" onClick={(evt) => { this.sync(evt); }}>Sync Now</button>
              </div>
            );
          }
        })()}
      </div>
    );
  }
}
