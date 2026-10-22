'use strict';

const { execFile } = require('child_process');
const path = require('path');
const electron = require('electron');

const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

execFile(String(electron), [path.join(__dirname, 'main.js')], { env }, err => {
  if (err) { console.error(err); process.exit(1); }
});
