import React from 'react';
import _ from 'lodash';
import Logger from 'logger';
import Confirm from 'views/components/Confirm';
import Error from 'views/components/Error';

var logger = new Logger('[ManageProfiles.jsx] ');

export default class ManageProfiles extends React.Component {
  constructor() {
    super();

    this.state = {
      dialog: null
    };
  }

  selectProfile(evt) {
    var selectedIndex = this.refs.profilesOptions.selectedIndex;
    var profilePath = this.refs.profilesOptions.options[selectedIndex].value;

    // Co-erce to display name
    _.each(this.props.params.profiles, (profile) => {
      if (profile.path_lower === profilePath.toLowerCase()) {
        profilePath = profile.path_display;
      }
    });
  
    logger.log("Profile changed", profilePath);
    browser.runtime.sendMessage({ action: 'selectProfile', profilePath: profilePath });
  }
  createProfile(evt) {
    logger.log("Create profile clicked");
    browser.runtime.sendMessage({ action: 'createProfile', name: this.refs.createProfileText.value });
  
    this.refs.createProfileText.value = '';
  }
  push(evt) {
    this.setState({
      dialog: (
        <Confirm 
          title="WARNING"
          message="Force pushing will overwrite ALL bookmarks for this profile that exist in your cloud account. Are you sure?"
          onConfirm={this.pushConfirmed.bind(this)}
          onCancel={this.dialogCancelled.bind(this)}
          />
      )
    });
  }
  pushConfirmed() {
    logger.log("Push clicked");
    browser.runtime.sendMessage({ action: 'push' });
    this.setState({ dialog: null });
  }
  pull(evt) {
    this.setState({
      dialog: (
        <Confirm 
          title="WARNING"
          message="Force pulling will wipe ALL existing local bookmarks and re-populate using the currently selected profile from your cloud account. Are you sure?"
          onConfirm={this.pullConfirmed.bind(this)}
          onCancel={this.dialogCancelled.bind(this)}
          />
      )
    });
  }
  pullConfirmed() {
    logger.log("Pull clicked");
    browser.runtime.sendMessage({ action: 'pull' });
    this.setState({ dialog: null });
  }
  dialogCancelled() {
    this.setState({ dialog: null });
  }
  render() {
    return (
      <div className="ManageProfiles">
        <h5 className="mb-2">Profiles</h5>
        {(() => {
          if (this.state.dialog) {
            return this.state.dialog
          } else {
            return (
              <div>
                <div className="mb-3">
                  <select ref="profilesOptions" onChange={(evt) => { this.selectProfile(evt); }} defaultValue={this.props.params.selectedProfile ? this.props.params.selectedProfile.toLowerCase() : null}>
                    <option key="k0" value="">[Unselected]</option>
                    {_.map(this.props.params.profiles, (profile, index) => {
                      logger.info('Found profile:', profile);
                      let value = profile.path_lower;
                      let text = profile.path_display.replace(/\.syncmarx/g, '').replace(/\//g, '');
        
                      return (
                        <option key={index} value={value}>{text}</option>
                      );
                    })}
                  </select>
                </div>
                <div className="mb-4">
                  Create profile: <input ref="createProfileText" type="text" placeholder="Profile name here"/> <button id="createprofile" type="button" onClick={(evt) => { this.createProfile(evt); }}>Create</button>
                </div>
                {(() => {
                  if (this.props.params.selectedProfile) {
                    return (
                      <div>
                        <button id="push" className="btn btn-warning btn-sm" type="button" onClick={(evt) => { this.push(evt); }}>Force Push</button> <button id="pull" className="btn btn-warning btn-sm" onClick={(evt) => { this.pull(evt); }}>Force Pull</button>
                      </div>
                    );
                  }
                })()}
              </div>
            )
          }
        })()}
        <Error message={this.props.params.errors[0] || ''}/>
      </div>
    );
  }
}
