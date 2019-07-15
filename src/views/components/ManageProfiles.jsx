import React from 'react';
import _ from 'lodash';
import Logger from 'util/Logger';
import Confirm from 'views/components/Confirm';

var logger = new Logger('[ManageProfiles.jsx]');

/**
 * The "Profiles" screen
 */
export default class ManageProfiles extends React.Component {
  constructor() {
    super();

    this.state = {
      dialog: null
    };
  }

  selectProfile(evt) {
    var selectedIndex = this.refs.profilesOptions.selectedIndex;
    var profileName = this.refs.profilesOptions.options[selectedIndex].value;

    // Co-erce to display name
    _.each(this.props.params.profiles, (profile) => {
      if (profile.name === profileName) {
        profileName = profile.name;
      }
    });
  
    logger.log("Profile changed", profileName);
    if (this.props.onSelectProfile) {
      this.props.onSelectProfile({ name: profileName });
    }
  }
  createProfile(evt) {
    logger.log("Create profile clicked");

    if (this.props.onCreateProfile) {
      this.props.onCreateProfile({ name: this.refs.createProfileText.value });
    }
  
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
    this.setState({ dialog: null });
    if (this.props.onPush) {
      this.props.onPush();
    }
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
    this.setState({ dialog: null });
    if (this.props.onPull) {
      this.props.onPull();
    }
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
                  <select ref="profilesOptions" onChange={(evt) => { this.selectProfile(evt); }} value={this.props.params.selectedProfile ? this.props.params.selectedProfile.name : ''}>
                    <option key="k0" value="">[Unselected]</option>
                    {_.map(this.props.params.profiles, (profile, index) => {
                      logger.info('Found profile:', profile);
                      let value = profile.name;
                      let text = profile.name;
        
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
      </div>
    );
  }
}
