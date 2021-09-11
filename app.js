"use strict";

const Homey = require('homey');

class SolcastApp extends Homey.App {

  onInit() {
    this.log('Initializing Solcast app ...');
    this.log('Registering flows');
    new Homey.FlowCardTriggerDevice('changedCurrentPower').register();
      }
}

module.exports = SolcastApp;
