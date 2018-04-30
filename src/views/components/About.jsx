import React from 'react';
import Logger from 'logger';
import Error from 'views/components/Error';

var logger = new Logger('[About.jsx] ');

export default class About extends React.Component {
  constructor() {
    super();

    this.state = {
    };
  }

  render() {
    return (
      <div className="About">
        <h5 className="mb-2">About</h5>
        <p>Developed by Greg McLeod</p>
        <p>Open Iconic — <a href="https://www.useiconic.com/open" target="_blank">www.useiconic.com/open</a></p>
        <p>&copy; 2018 by McLeodGaming Inc.</p>
        <p>All Rights Reserved.</p>
        <a href="https://paypal.me/McLeodGaming" target="_blank"><button id="donate" type="button" className="btn btn-warning">Donate</button></a>
      </div>
    );
  }
}
