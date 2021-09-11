'use strict';

const Homey	= require('homey');
const { ManagerDrivers } = require('homey');

class SolCastDriver extends Homey.Driver {

	onInit() {
        this.log('SolCast driver has been initialized');

	}

  onPair (socket) {
    let devices = [];
}
}

module.exports = SolCastDriver;

// Action for Flow
/*
"actions": [
{
 "id": "upload",
 "title": {
	 "en": "Upload PV production"
 },
 "placeholder": {
	"en": "Drop PV tag here"
},
 "args": [
{
"type": "number",
"name": "PVoutput",
"min": 0,
"max": 1,
"step": 0.01,
"label": "kWh",
"labelMultiplier": 0,
"labelDecimals": 2
}
]
}
],
*/
