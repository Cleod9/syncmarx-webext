import React from 'react';
import ReactLoading from 'react-loading';
import Logger from 'util/Logger';
import './Initialization.scss';

var logger = new Logger('[Initialization.jsx]');

export default class Initialization extends React.Component {
  constructor() {
    super();

    this.state = {
    };
  }

  render() {
    return (
      <div className="Initialization text-center">
        <h5>Please wait...</h5>
        <ReactLoading type="bubbles" color="#cccccc" height={64} width={64} className="Initialization-loading" />
      </div>
    );
  }
}
