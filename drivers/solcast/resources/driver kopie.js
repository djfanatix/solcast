'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

const baseUrl = 'https://api.solcast.com.au/';

class SolCast extends Homey.Driver {
    onPair(socket) {
        let systemId;
        let apiKey;
        let equipmentList;

        socket.on('validate', (pairData, callback) => {
            apiKey = pairData.apiKey
            systemId = pairData.systemId

            const equipmentUrl = `${baseUrl}/equipment/${systemId}/list?api_key=${apiKey}&format=json`

            fetch(equipmentUrl)
                .then(result => {
                    if (result.ok) {
                        return result.json();
                    } else {
                        callback(new Error(Homey.__('login_error')));
                    }
                }).then(response => {
                    equipmentList = response.reporters.list;

                    callback(null, true);
                }).catch(error => {
                    callback(new Error(Homey.__('network_error')));
                });
        });

        socket.on('list_devices', (_, callback) => {
            try {
                const devices = equipmentList.map(item => ({
                    name: item.name,
                    data: {
                        sid: systemId,
                        serial_number: item.serialNumber
                    },
				    settings: { key: apiKey	}
                }));

                callback(null, devices);
            } catch (error) {
                this.error(error);
                callback(error);
            }
        });
    }
}

module.exports = SolCast;
