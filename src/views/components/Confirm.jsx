import React from 'react';
import Logger from 'util/Logger';
import Error from 'views/components/Error';

var logger = new Logger('[Confirm.jsx]');

export default class Confirm extends React.Component {
  constructor() {
    super();

    this.state = {
    };
  }
  onConfirm() {
    if (this.props.onConfirm) {
      this.props.onConfirm();
    }
  }
  onCancel() {
    if (this.props.onCancel) {
      this.props.onCancel();
    }
  }
  render() {
    return (
      <div className="Confirm card container-fluid">
        <h5 className="mb-2 text-danger">{this.props.title}</h5>
        <p className="text-danger">{this.props.message}</p>
        <div className="my-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={this.props.onConfirm.bind(this)}>{this.props.confirmText || 'Yes'}</button> <button type="button" className="btn btn-danger btn-sm" onClick={this.props.onCancel.bind(this)}>{this.props.cancelText || 'Cancel'}</button>
        </div>
      </div>
    );
  }
}
