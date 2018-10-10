/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
const https = require('https');

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
    BIKE_STATION_INFO_MESSAGE_CARD_HEADER: 'Station Info: Bike Count'
};

const PERMISSIONS = ['read::alexa:device:all:address'];

const GBFS_HOST = 'gbfs.bluebikes.com';
const GBFS_PORT = 443;

const BIKE_STATION_STATUS_REQUEST_OPTIONS = {
    host: GBFS_HOST,
    path: '/gbfs/en/station_status.json',
    port: GBFS_PORT
};

const BIKE_STATION_REQUEST_OPTIONS = {
    host: GBFS_HOST,
    path: '/gbfs/en/station_information.json',
    port: GBFS_PORT
};

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

// const retrieveStationInfo = async () => {
//
//     console.log('retrieveStationInfo');
//     https.get(BIKE_STATION_STATUS_REQUEST_OPTIONS, (resp) => {
//         let data = '';
//
//         // A chunk of data has been recieved.
//         resp.on('data', (chunk) => {
//             data += chunk;
//         });
//
//         // The whole response has been received. Print out the result.
//         resp.on('end', () => {
//             var stationArray = JSON.parse(data).data.stations;
//             for (var i = 0; i < stationArray.length; i++) {
//                 var station = stationArray[i];
//                 if (station.station_id == '71') {
//                     console.log('returning data for station 71: '+station.num_bikes_available);
//                     return station.num_bikes_available;
//                 }
//             }
//         });
//     });
// }

const BlueBikeStationInfoIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'BlueBikeStationInfoIntent';
    },
    async handle(handlerInput) {

        console.log('requesting how many bikes');

        const {requestEnvelope, serviceClientFactory, responseBuilder} = handlerInput;

        const consentToken = requestEnvelope.context.System.user.permissions && requestEnvelope.context.System.user.permissions.consentToken;

        if (!consentToken) {
            console.log('requesting consent to get device address');
            return responseBuilder
                .speak(messages.NOTIFY_MISSING_PERMISSIONS)
                .withAskForPermissionsConsentCard(PERMISSIONS)
                .getResponse();
        }

        try {
            console.log('attempting to retrieve address');
            const {deviceId} = requestEnvelope.context.System.device;
            console.log('device id: ' + deviceId);
            const deviceAddressServiceClient = serviceClientFactory.getDeviceAddressServiceClient();
            const address = await deviceAddressServiceClient.getFullAddress(deviceId);
            if (address.addressLine1 === null && address.stateOrRegion === null) {
                console.log('no address is set for the device')
                return responseBuilder
                    .speak(messages.NO_ADDRESS)
                    .getResponse();
            }
            var respMessage = messages.BIKE_STATION_INFO_MESSAGE.replace(messages.BIKE_STATION_MESSAGE_COUNT_VARIABLE, '8').replace(messages.BIKE_STATION_MESSAGE_ADDRESS_VARIABLE, 'Conway Park - Somerville Avenue');
            console.log(respMessage);
            return responseBuilder
                .speak(respMessage)
                .withSimpleCard(messages.BIKE_STATION_INFO_MESSAGE_CARD_HEADER, respMessage)
                .getResponse();
            // https.get(BIKE_STATION_REQUEST_OPTIONS, (resp) => {
            //     let data = '';
            //
            //     // A chunk of data has been received.
            //     resp.on('data', (chunk) => {
            //         data += chunk;
            //     });
            //
            //     // The whole response has been received. Print out the result.
            //     resp.on('end', () => {
            //         var stationArray = JSON.parse(data).data.stations;
            //         for (var i = 0; i < stationArray.length; i++) {
            //             var station = stationArray[i];
            //             if (station.station_id == '71') {
            //                 console.log('returning data for station 71: '+station.num_bikes_available);
            //                 // TODO handle is/are when there are 0,1,2 etc bikes available
            //                 var respMessage = messages.BIKE_STATION_INFO_MESSAGE.replace(messages.BIKE_STATION_MESSAGE_VARIABLE, station.num_bikes_available);
            //                 console.log(respMessage);
            //                 return responseBuilder
            //                     .speak(respMessage)
            //                     .reprompt(respMessage)
            //                     .withSimpleCard('Mary Katherine is great!', respMessage)
            //                     .getResponse();
            //             }
            //         }
            //     });
            // });
            // var respMessage = messages.BIKE_STATION_INFO_MESSAGE.replace(messages.BIKE_STATION_MESSAGE_VARIABLE, stationBikeCount);
            // console.log(respMessage);
            // return response
            //     .speak()
            //     .withSimpleCard('Mary Katherine is great!', respMessage)
            //     .getResponse();
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
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .withApiClient(new Alexa.DefaultApiClient())
    .lambda();
