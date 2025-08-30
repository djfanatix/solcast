## Usage
You could use the app to switch on electric appliances or charge a car or battery based on the forecast solar power, to maximize self-consumption.
You can compare the daily forecast with your actual production.
The app uses 2 providers: Solcast and Forecast.Solar

## Solcast Registration
Sign up your solar installation at [Solcast Toolkit](https://toolkit.solcast.com.au/live-forecast)
You have to setup the 'Free' Home PV owner account (hobbyist) which gives you (currently) 50 API calls a day.
Fill in all the exact details of your solar installation.

## Solcast Setup
You have to provide your API-key and Resource ID to get the app working.
API Key can be found under - Your name - Your API key
Resource ID can be found if you click on your location on the main screen.
#

## Solcast API Calls
* Old users have 50 API calls/day
* New users have 10 API calls/day

You can have 2 Solar installations in 1 account, but each update is 1 API call/each installation.

You can setup a flow to trigger a notification when the 

## Solcast API Fetch
Since all the automatic polling is removed, you have to set up flows to trigger an update of the values.
You can choose the intervals yourself. See examples in the second post.
* 'Fetch Midnight' : This updates the Today and Tomorrow  values
(according Solcast the API calls reset at UTC, in my personal experience it is UTC+4 = 02.00LT CEST)
* 'Fetch update': This updates all the values except Today. 
After this update, the app will update the values every 30 minutes (during daylight), based on the last retrieved data.
* You can click the button to fetch an update

## Forecast.Solar setup
Forecast.Solar doesn't need an API key.
You can do maximum 12 API calls for each running hour. Extra requests are also counted as API calls.
You can add multiple installations (or different orientations)

To setup you need the enter the following details during pairing:
- kWp of solar installation (use . for decimals) example: 6.2
- Tilt of solar installation (0 = flat) example: 35
- Orientation of solar installation (180 = south, 90 = east) 

Advanced settings: you can change the damping factor for efficiency or performance loss. (default = 1)