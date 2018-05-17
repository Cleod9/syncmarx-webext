import React from 'react';
import Logger from 'util/Logger';

var logger = new Logger('[Error.jsx]');

export default class Error extends React.Component {
  constructor() {
    super();

    this.state = {};
  }

  render() {
    return (
      <div className="Error mx-auto">
        {(() => {
          if (this.props.message) {
            return (
              <div className="alert alert-danger my-1" role="alert">{this.props.message}</div>
            );
          }
        })()}
      </div>
    );
  }
}
