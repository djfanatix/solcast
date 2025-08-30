'use strict';

const Homey	= require('homey');
const { ManagerDrivers } = require('homey');

class ForecastsolarDriver extends Homey.Driver {

async onInit() {
        this.log('ForecastSolar driver has been initialized');
		

	}
  onPair (socket) {
    let devices = [];
}
}


module.exports = ForecastsolarDriver;


