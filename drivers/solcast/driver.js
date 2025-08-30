'use strict';

const Homey	= require('homey');
const { ManagerDrivers } = require('homey');

class SolCastDriver extends Homey.Driver {

async onInit() {
        this.log('SolCast driver has been initialized');
		
const card = this.homey.flow.getActionCard('polling');
card.registerRunListener(async(args) => {
this.log('Start manual polling with Flow')
	await args.device.polling();
		});    

const midnight = this.homey.flow.getActionCard('midnight');
midnight.registerRunListener(async(args) => {
this.log('Fetch Midnight values')
	await args.device.midnightfetch();
		});    
	}
  onPair (socket) {
    let devices = [];
}
}


module.exports = SolCastDriver;


