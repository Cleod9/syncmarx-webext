require('es6-promise').polyfill();
require('es6-symbol/implement');
require('normalize.css');
require('bootstrap/dist/css/bootstrap.css');
require('./global.scss');


import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsContainer from 'views/containers/SettingsContainer';

window.browser = require('webextension-polyfill');

// Render the UI for the extension
var container = document.getElementById('main');
var root = createRoot(container);
root.render(<SettingsContainer />);
