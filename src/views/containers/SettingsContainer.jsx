import React from 'react';
import classNames from 'classnames';
import About from 'views/components/About';
import Authentication from 'views/components/Authentication';
import Home from 'views/components/Home';
import Initialization from 'views/components/Initialization';
import ManageProfiles from 'views/components/ManageProfiles';
import Options from 'views/components/Options';
import Logger from 'util/Logger';
import Error from 'views/components/Error';
import './SettingsContainer.scss';

var logger = new Logger('[SettingsContainer.jsx]');
var version = require('../../../version.json');

/**
 * The root view for the extension UI
 */
export default class SettingsContainer extends React.Component {
  constructor() {
    super();

    this.onMessage = this.onMessage.bind(this);

    this.state = {
      view: Initialization,
      previousView: Initialization,
      // Default settings
      profiles: [],
      provider: null,
      providerDropdown: 'dropbox',
      selectedProfile: null,
      lastSyncTime: 0,
      authorized: false,
      syncRate: 5,
      compression: true,
      totalBookmarks: 0,
      totalFolders: 0,
      errors: []
    };

    browser.runtime.onMessage.addListener(this.onMessage);
    
    browser.runtime.sendMessage({ action: 'init' });
  }

  onMessage(data) {
    if (data.action === 'initComplete') {
      if (data.authorized) {
        this.setState({ authorized: true, compression: data.compression, previousView: Home, providerDropdown: data.providerDropdown });

        browser.runtime.sendMessage({ action: 'getProfiles' });
      } else {
        this.setState({ view: Authentication, compression: data.compression, providerDropdown: data.providerDropdown });
      }
      logger.log('panel initialized');
    } else if (data.action === 'getProfilesComplete' || data.action === 'createProfileComplete') {
      this.setState({
        profiles: data.profiles || this.state.profiles,
        selectedProfile: data.selectedProfile,
        provider: data.provider || this.state.provider,
        syncRate: typeof data.syncRate === 'number' ? data.syncRate : this.state.syncRate,
        totalBookmarks: data.totalBookmarks || this.state.totalBookmarks,
        totalFolders: data.totalFolders || this.state.totalFolders,
        lastSyncTime: data.lastSyncTime || this.state.lastSyncTime
      });

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
      this.setState({ authorized: true });
      this.showPage(Home);
      browser.runtime.sendMessage({ action: 'getProfiles' });
    } else if (data.action === 'deauthComplete') {
      this.setState({ 
        authorized: false,
        profiles: [],
        selectedProfile: null,
        lastSyncTime: 0
      });
      this.showPage(Authentication);
    } else if (data.action === 'pushComplete') {
      this.setState({
        view: this.getPreviousView(),
        previousView: null,
        totalBookmarks: data.totalBookmarks || 0,
        totalFolders: data.totalFolders || 0,
        lastSyncTime: data.lastSyncTime
      });
    } else if (data.action === 'pullComplete') {
      this.setState({
        view: this.getPreviousView(),
        previousView: null,
        totalBookmarks: data.totalBookmarks || 0,
        totalFolders: data.totalFolders || 0,
        lastSyncTime: data.lastSyncTime,
        compression: data.compression
      });
    } else if (data.action === 'syncComplete') {
      this.setState({
        view: this.getPreviousView(),
        previousView: null,
        totalBookmarks: data.totalBookmarks || 0,
        totalFolders: data.totalFolders || 0,
        lastSyncTime: data.lastSyncTime,
        compression: data.compression
      });
    } else if (data.action === 'changeCompressionComplete') {
      this.setState({
        compression: data.compression
      });
    }

    if (data.action.match(/Error$/g)) {
      this.setState({ view: this.getPreviousView(), errors: [data.message]});
    } else {
      this.setState({ errors: []});
    }
  }

  showPage(page) {
    this.setState({ view: page, previousView: this.state.view });
  }
  onAuth(params) {
    browser.runtime.sendMessage({ action: 'auth', provider: params.provider, credentials: params.credentials });
    this.showPage(Initialization);
  }
  onDeauth(params) {
    browser.runtime.sendMessage({ action: 'deauth' });
    this.showPage(Initialization);
  }
  onSync() {
    browser.runtime.sendMessage({ action: 'sync' });
    this.showPage(Initialization);
  }
  onPush() {
    browser.runtime.sendMessage({ action: 'push' });
    this.showPage(Initialization);
  }
  onPull() {
    browser.runtime.sendMessage({ action: 'pull' });
    this.showPage(Initialization);
  }
  onCreateProfile(params) {
    browser.runtime.sendMessage({ action: 'createProfile', name: params.name });
    this.showPage(Initialization);
  }
  onSelectProfile(params) {
    browser.runtime.sendMessage({ action: 'selectProfile', name: params.name });
  }
  onChangeSyncRate(params) {
    browser.runtime.sendMessage({ action: 'changeSyncRate', syncRate: params.syncRate });
  }
  onChangeCompression(params) {
    browser.runtime.sendMessage({ action: 'changeCompression', compression: params.compression });
  }
  onProviderDropdownChanged(params) {
    browser.runtime.sendMessage({ action: 'changeProviderDropdown', providerDropdown: params.providerDropdown });
  }
  getPreviousView() {
    if (this.state.previousView === Initialization) {
      // A problem must have occured, show auth screen
      return Authentication;
    } else {
      // Show whatever the previous view was
      return this.state.previousView;
    }
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
                      'd-none': (this.state.authorized) ? true : false
                    })
                  }
                  onClick={() => { this.showPage(Authentication)}}
                  >
                  <input type="radio" name="SettingsContainer-navBar" id="SettingsContainer-nav1" autoComplete="off" defaultChecked={this.state.view === Authentication}/> Setup
                </label>
                <label 
                  className={
                    classNames('btn btn-sm', {
                      'btn-outline-primary': this.state.view === Home,
                      'btn-outline-secondary': this.state.view !== Home,
                      'd-none': (this.state.authorized) ? false : true
                    })
                  }
                  onClick={() => { this.showPage(Home)}}
                  >
                  <input type="radio" name="SettingsContainer-navBar" id="SettingsContainer-nav1" autoComplete="off" defaultChecked={this.state.view === Home}/> Home
                </label>
                <label 
                  className={
                    classNames('btn btn-sm', {
                      'btn-outline-primary': this.state.view === ManageProfiles,
                      'btn-outline-secondary': this.state.view !== ManageProfiles,
                      'd-none': (this.state.authorized) ? false : true
                    })
                  }
                  onClick={() => { this.showPage(ManageProfiles)}}
                  >
                  <input type="radio" name="SettingsContainer-navBar" id="SettingsContainer-nav2" autoComplete="off" defaultChecked={this.state.view === ManageProfiles}/> Profiles
                </label>
                <label 
                  className={
                    classNames('btn btn-sm', {
                      'btn-outline-primary': this.state.view === Options,
                      'btn-outline-secondary': this.state.view !== Options,
                      'd-none': (this.state.authorized) ? false : true
                    })
                  }
                  onClick={() => { this.showPage(Options)}}
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
                  onClick={() => { this.showPage(About)}}
                  >
                  <input type="radio" name="SettingsContainer-navBar" id="SettingsContainer-nav3" autoComplete="off" defaultChecked={this.state.view === About}/> About
                </label>
              </div>
            );
          }
        })()}
        <this.state.view 
          params={this.state}
          onAuth={this.onAuth.bind(this)}
          onDeauth={this.onDeauth.bind(this)}
          onSelectProfile={this.onSelectProfile.bind(this)}
          onCreateProfile={this.onCreateProfile.bind(this)}
          onSync={this.onSync.bind(this)}
          onPush={this.onPush.bind(this)}
          onPull={this.onPull.bind(this)}
          onChangeSyncRate={this.onChangeSyncRate.bind(this)}
          onChangeCompression={this.onChangeCompression.bind(this)}
          onProviderDropdownChanged={this.onProviderDropdownChanged.bind(this)} />
        <Error message={this.state.errors[0] || ''}/>
      </section>
    );
  }
}