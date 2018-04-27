import React from 'react';
import classNames from 'classnames';
import About from 'views/components/About';
import Authentication from 'views/components/Authentication';
import Home from 'views/components/Home';
import Initialization from 'views/components/Initialization';
import ManageProfiles from 'views/components/ManageProfiles';
import Options from 'views/components/Options';
import Logger from 'logger';
import './SettingsContainer.scss';

var logger = new Logger('[SettingsContainer.jsx] ');
var version = require('../../../version.json');

export default class SettingsContainer extends React.Component {
  constructor() {
    super();

    this.onMessage = this.onMessage.bind(this);

    this.state = {
      view: Initialization,
      // Default settings
      profiles: [],
      selectedProfile: null,
      lastSyncTime: 0,
      accessToken: null,
      syncRate: 5,
      errors: []
    };

    browser.runtime.onMessage.addListener(this.onMessage);
    
    browser.storage.local.get('accessToken')
      .then((results) => {
        if (results.accessToken) {
          this.setState({ accessToken: results.accessToken });

          browser.runtime.sendMessage({ action: 'getProfiles' });
        } else {
          this.setState({ view: Authentication });
        }
        logger.log('panel initialized');
      });
  }

  onMessage(data) {
    if (data.action === 'getProfilesComplete' || data.action === 'createProfileComplete') {
      this.setState({
        profiles: data.profiles || this.state.profiles,
        selectedProfile: data.selectedProfile,
        syncRate: data.syncRate || this.storage.syncRate });

      logger.log('panel initialized, profiles retrieved', data);

      if (data.action === 'getProfilesComplete') {
        this.showPage(Home);
      } else {
        this.showPage(ManageProfiles);
      }
    } else if (data.action === 'selectProfileComplete') {
      logger.log('profile selection completed');
      this.setState({ selectedProfile: data.selectedProfile });
      this.showPage(ManageProfiles);
    } else if (data.action === 'changeSyncRateComplete') {
      logger.log('sync rate change completed');
      this.setState({ syncRate: data.syncRate });
      this.showPage(Options);
    } else if (data.action === 'authComplete') {
      this.setState({ 
        accessToken: data.accessToken,
        view: Home
      });
      this.showPage(Home);
      browser.runtime.sendMessage({ action: 'getProfiles' });
    } else if (data.action === 'deauthComplete') {
      this.setState({ 
        accessToken: '',
        profiles: [],
        selectedProfile: null,
        lastSyncTime: 0
      });
      this.showPage(Authentication);
    }

    if (data.action.match(/Error$/g)) {
      this.setState({ errors: [data.message]});
    } else {
      this.setState({ errors: []});
    }
  }

  showPage(page) {
    this.setState({ view: page });
  }

  render() {
    return (
      <section className="Settings container-fluid p-3 text-center">
        <img src="icons/icon_48.png"/>
        <div className="Settings-logo mb-2">
          <strong>syncmarx v{version} (alpha)</strong>
          <div className="Settings-logoBorder pt-2 mb-1 d-inline-block"></div>
        </div>
        {(() => {
          if (this.state.view !== Initialization) {
            return (
              <div className="Settings-nav btn-group btn-group-toggle mb-4" data-toggle="buttons">
                <label 
                  className={
                    classNames('btn btn-sm', {
                      'btn-outline-primary': this.state.view === Authentication,
                      'btn-outline-secondary': this.state.view !== Authentication,
                      'd-none': (this.state.accessToken) ? true : false
                    })
                  }
                  onClick={() => { this.setState({ view: Authentication })}}
                  >
                  <input type="radio" name="SettingsContainer-navBar" id="SettingsContainer-nav1" autoComplete="off" defaultChecked={this.state.view === Authentication}/> Setup
                </label>
                <label 
                  className={
                    classNames('btn btn-sm', {
                      'btn-outline-primary': this.state.view === Home,
                      'btn-outline-secondary': this.state.view !== Home,
                      'd-none': (this.state.accessToken) ? false : true
                    })
                  }
                  onClick={() => { this.setState({ view: Home })}}
                  >
                  <input type="radio" name="SettingsContainer-navBar" id="SettingsContainer-nav1" autoComplete="off" defaultChecked={this.state.view === Home}/> Home
                </label>
                <label 
                  className={
                    classNames('btn btn-sm', {
                      'btn-outline-primary': this.state.view === ManageProfiles,
                      'btn-outline-secondary': this.state.view !== ManageProfiles,
                      'd-none': (this.state.accessToken) ? false : true
                    })
                  }
                  onClick={() => { this.setState({ view: ManageProfiles })}}
                  >
                  <input type="radio" name="SettingsContainer-navBar" id="SettingsContainer-nav2" autoComplete="off" defaultChecked={this.state.view === ManageProfiles}/> Profiles
                </label>
                <label 
                  className={
                    classNames('btn btn-sm', {
                      'btn-outline-primary': this.state.view === Options,
                      'btn-outline-secondary': this.state.view !== Options,
                      'd-none': (this.state.accessToken) ? false : true
                    })
                  }
                  onClick={() => { this.setState({ view: Options })}}
                  >
                  <input type="radio" name="SettingsContainer-navBar" id="SettingsContainer-nav3" autoComplete="off" defaultChecked={this.state.view === Options}/> Options
                </label>
                <label 
                  className={
                    classNames('btn btn-sm', {
                      'btn-outline-primary': this.state.view === About,
                      'btn-outline-secondary': this.state.view !== About
                    })
                  }
                  onClick={() => { this.setState({ view: About })}}
                  >
                  <input type="radio" name="SettingsContainer-navBar" id="SettingsContainer-nav3" autoComplete="off" defaultChecked={this.state.view === About}/> About
                </label>
              </div>
            );
          }
        })()}
        <this.state.view params={this.state}/>
      </section>
    );
  }
}