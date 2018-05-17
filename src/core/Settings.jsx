require('isomorphic-fetch');
require('es6-promise').polyfill();
require('normalize.css');
require('bootstrap/dist/css/bootstrap.css');
require('./global.scss');


import React from 'react';
import ReactDOM from 'react-dom';
import SettingsContainer from 'views/containers/SettingsContainer';

window.browser = require('webextension-polyfill');

ReactDOM.render(<SettingsContainer />, document.getElementById('main'));
