/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
const fetch = require("node-fetch");

const messages = {
    WELCOME_CARD_HEADER: 'Blue Bikes : Welcome',
    WELCOME_MESSAGE: 'Welcome to Blue Bikes. You can ask me if there are bikes available',
    WHAT_DO_YOU_WANT: 'What do you want to ask?',
    NOTIFY_MISSING_PERMISSIONS: 'Please enable Location permissions in the Amazon Alexa app.',
    NO_ADDRESS: 'It looks like you don\'t have an address set. You can set your address from the companion app.',
    ADDRESS_AVAILABLE: 'Here is your full address: ',
    ERROR: 'Uh Oh. Looks like something went wrong.',
    LOCATION_FAILURE: 'There was an error with the Device Address API. Please try again.',
    GOODBYE: 'Bye! Thanks for using the Sample Device Address API Skill!',
    UNHANDLED: 'This skill doesn\'t support that. Please ask something else.',
    HELP: 'You can use this skill by asking something like: whats my address?',
    STOP: 'Bye! Thanks for using the Sample Device Address API Skill!',
    BIKE_STATION_MESSAGE_COUNT_VARIABLE: '[X]',
    BIKE_STATION_MESSAGE_ADDRESS_VARIABLE: '[Y]',
    BIKE_STATION_INFO_MESSAGE: 'There are [X] bikes available at your local station at [Y]',
    BIKE_STATION_INFO_MESSAGE_CARD_HEADER: 'Station Info: Bike Count',
    BIKE_STATION_LOCAL_MESSAGE: 'Your local bike dock is [Y]',
    BIKE_STATION_LOCAL_MESSAGE_CARD_HEADER: 'Station Info: Local Station'
};

const PERMISSIONS = ['read::alexa:device:all:address'];
const GOOGLE_GEOCODING_BASE = 'https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyDR4ru3toHxgFa5_eD2s3RX_Apo1xdY-kc&address=';
const GBFS_HOST = 'https://gbfs.bluebikes.com';
const GBFS_STATION_INFO = '/gbfs/en/station_information.json';
const GBFS_STATION_STATUS = '/gbfs/en/station_status.json';

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {

        return handlerInput.responseBuilder
            .speak(messages.WELCOME_MESSAGE)
            .reprompt(messages.WELCOME_MESSAGE)
            .withSimpleCard(messages.WELCOME_CARD_HEADER, messages.WELCOME_MESSAGE)
            .getResponse();
    },
};

function closestLocation(targetLocation, locationData) {
    function vectorDistance(dx, dy) {
        return Math.sqrt(dx * dx + dy * dy);
    }

    function locationDistance(target, source) {
        var dx = target.lat - source.lat,
            dy = target.lng - source.lon;
        return vectorDistance(dx, dy);
    }

    return locationData.reduce(function(prev, curr) {
        var prevDistance = locationDistance(targetLocation, prev),
            currDistance = locationDistance(targetLocation, curr);
        return (prevDistance < currDistance) ? prev : curr;
    });
}

const addressLocationGeocode = async address => {
    try {
        var addressStr = address.addressLine1 + ', ';
        if (address.addressLine2) {
            addressStr += address.addressLine2 + ', ';
        }
        if (address.addressLine3) {
            addressStr += address.addressLine3 + ', ';
        }
        addressStr += address.city + ', ' + address.stateOrRegion + ', ' + address.postalCode;
        console.log('address is: ' + addressStr);
        const response = await fetch(GOOGLE_GEOCODING_BASE+addressStr);
        if (response == null) {
            console.log('invalid response from google geocode api');
            throw 'invalid response from google geocode api';
        }
        const json = await response.json();
        if (json.status != 'OK') {
            console.log('invalid response from google geocode api');
            throw 'invalid response from google geocode api';
        }
        console.log(
            `City: ${json.results[0].formatted_address} -`,
            `Latitude: ${json.results[0].geometry.location.lat} -`,
            `Longitude: ${json.results[0].geometry.location.lng}`
        );
        return json.results[0].geometry.location;
    } catch (error) {
        console.log(error);
    }
};

async function retrieveBlueBikeStationStatus() {
    console.log('getting GBFS Station Status');
    const response = await fetch(GBFS_HOST + GBFS_STATION_STATUS);
    const json = await response.json();
    if (json.data == null || json.data.stations == null) {
        console.log('invalid response from GBFS API');
        throw 'invalid response from GBFS API';
    }
    return json.data.stations;
}

async function retrieveLocalStation(requestEnvelope, serviceClientFactory) {
    const {deviceId} = requestEnvelope.context.System.device;
    console.log('device id: ' + deviceId);
    const deviceAddressServiceClient = serviceClientFactory.getDeviceAddressServiceClient();
    const address = await deviceAddressServiceClient.getFullAddress(deviceId);
    if (address.addressLine1 === null && address.stateOrRegion === null) {
        console.log('no address is set for the device');
        throw 'no address is set for this device';
    }
    const deviceGeoLoc = await addressLocationGeocode(address);
    console.log('getting GBFS Station Info for location: ' + deviceGeoLoc.lat + ' ' + deviceGeoLoc.lng);
    const stationInfoJson = await((await(fetch(GBFS_HOST + GBFS_STATION_INFO))).json());
    if (stationInfoJson.data == null || stationInfoJson.data.stations == null) {
        console.log('invalid response from GBFS API');
        throw 'invalid response from GBFS API';
    }
    const localStation = closestLocation(deviceGeoLoc, stationInfoJson.data.stations);
    if (localStation == null) {
        throw 'no local station found';
    }
    console.log('returning data for station: ' + localStation.station_id);
    return localStation;
}

const BlueBikeStationInfoIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'BlueBikeStationInfoIntent';
    },
    async handle(handlerInput) {
        console.log('requesting how many bikes');
        try {
            const {requestEnvelope, serviceClientFactory, responseBuilder} = handlerInput;
            const consentToken = requestEnvelope.context.System.user.permissions && requestEnvelope.context.System.user.permissions.consentToken;
            if (!consentToken) {
                console.log('requesting consent to get device address');
                return responseBuilder
                    .speak(messages.NOTIFY_MISSING_PERMISSIONS)
                    .withAskForPermissionsConsentCard(PERMISSIONS)
                    .getResponse();
            }
            console.log('attempting to retrieve address');
            const localStation = await retrieveLocalStation(requestEnvelope, serviceClientFactory);
            const stationArray = await retrieveBlueBikeStationStatus();
            const stationStatus = stationArray.find(station => station.station_id == localStation.station_id);
            if (stationStatus != null) {
                console.log('returning data for local station: '+stationStatus.num_bikes_available);
                var respMessage = messages.BIKE_STATION_INFO_MESSAGE.replace(messages.BIKE_STATION_MESSAGE_COUNT_VARIABLE, stationStatus.num_bikes_available).replace(messages.BIKE_STATION_MESSAGE_ADDRESS_VARIABLE, 'Conway Park - Somerville Avenue');
                console.log(respMessage);
                return responseBuilder
                    .speak(respMessage)
                    .withSimpleCard(messages.BIKE_STATION_INFO_MESSAGE_CARD_HEADER, respMessage)
                    .getResponse();
            }
            throw 'error fetching data from the Blue Bike Station Status API';
        } catch (error) {
            console.log('error: '+error);
            if (error.name !== 'ServiceError') {
                return responseBuilder
                    .speak(messages.ERROR)
                    .getResponse();
            }
            throw error;
        }
    },
};

const FindLocalDockIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'FindLocalStationInfoIntent';
    },
    async handle(handlerInput) {
        try {
            console.log('requesting local station');
            const {requestEnvelope, serviceClientFactory, responseBuilder} = handlerInput;
            const consentToken = requestEnvelope.context.System.user.permissions && requestEnvelope.context.System.user.permissions.consentToken;
            if (!consentToken) {
                console.log('requesting consent to get device address');
                return responseBuilder
                    .speak(messages.NOTIFY_MISSING_PERMISSIONS)
                    .withAskForPermissionsConsentCard(PERMISSIONS)
                    .getResponse();
            }
            console.log('attempting to retrieve address');
            const localStation = await retrieveLocalStation(requestEnvelope, serviceClientFactory);
            var respMessage = messages.BIKE_STATION_LOCAL_MESSAGE.replace(messages.BIKE_STATION_MESSAGE_ADDRESS_VARIABLE, localStation.name);
            console.log(respMessage);
            return responseBuilder
                .speak(respMessage)
                .withSimpleCard(messages.BIKE_STATION_LOCAL_MESSAGE_CARD_HEADER, respMessage)
                .getResponse();
        } catch (error) {
            console.log('error: '+error);
            if (error.name !== 'ServiceError') {
                return responseBuilder
                    .speak(messages.ERROR)
                    .getResponse();
            }
            throw error;
        }
    },
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speechText = 'You can say hello to me!';

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withSimpleCard('Hello World', speechText)
            .getResponse();
    },
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent' || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speechText = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speechText)
            .withSimpleCard('Hello World', speechText)
            .getResponse();
    },
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
        return handlerInput.responseBuilder.getResponse();
    },
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.message}`);
        return handlerInput.responseBuilder
            .speak('Sorry, I can\'t understand the command. Please say again.')
            .reprompt('Sorry, I can\'t understand the command. Please say again.')
            .getResponse();
    },
};

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
    .addRequestHandlers(
        LaunchRequestHandler,
        BlueBikeStationInfoIntentHandler,
        FindLocalDockIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .withApiClient(new Alexa.DefaultApiClient())
    .lambda();
