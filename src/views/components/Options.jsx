import React from 'react';
import Logger from 'util/Logger';
import Error from 'views/components/Error';
import Confirm from 'views/components/Confirm';

var logger = new Logger('[Options.jsx]');

export default class Options extends React.Component {
  constructor() {
    super();

    this.state = {
      dialog: null
    };
  }

  syncRate(evt) {
    var rate = parseInt(this.refs.synctimeText.value);
    if (typeof rate === 'number' && rate >= 0) {
      this.refs.synctimeText.value = rate + '';
      logger.log("Sync rate updated");
      if (this.props.onChangeSyncRate) {
        this.props.onChangeSyncRate({ syncRate: rate });
      }
    }
  }
  onUnlink(evt) {
    logger.log("Deauth clicked");
    this.setState({
      dialog: (
        <Confirm 
          title="WARNING"
          message="This cannot be undone, and you will have to re-link to Dropbox again from scratch in the future. Are you sure?"
          onConfirm={this.deauthConfirmed.bind(this)}
          onCancel={this.dialogCancelled.bind(this)}
          />
      )
    });
  }
  deauthConfirmed() {
    this.setState({ dialog: null });
    if (this.props.onDeauth) {
      this.props.onDeauth();
    }
  }
  dialogCancelled() {
    this.setState({ dialog: null });
  }
  
  render() {
    return (
      <div className="Options">
        <h5 className="mb-2">Options</h5>
        {(() => {
          if (this.state.dialog) {
            return this.state.dialog
          } else {
            return (
              <div>
                <div className="mb-4 text-center">
                  <div className="mb-1">
                    Sync Every (Minutes):
                  </div>
                  <div className="mb-1">
                    <input ref="synctimeText" type="text" placeholder="Sync interval in minutes" onChange={(evt) => { this.syncRate(evt); }} defaultValue={this.props.params.syncRate}/>
                  </div>
                  <p className="small">(Set to 0 to disable)</p>
                </div>
                <button id="deauth" className="btn btn-danger btn-sm" type="button" onClick={(evt) => { this.onUnlink(evt); }}>Unlink From Dropbox</button>
              </div>
            );
          }
        })()}
        <Error message={this.props.params.errors[0] || ''}/>
      </div>
    );
  }
}
