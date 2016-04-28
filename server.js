require('dotenv').config();

var aws = require('aws-sdk');

var applicationId = process.env['ALEXA_APPLICATION_ID'];
var queueUrl = process.env['SQS_QUEUE_URL'];
var sqsRegion = process.env['SQS_REGION'];

if (!applicationId) {
    console.log('ALEXA_APPLICATION_ID not set.');
    process.exit(1);
    return;
}

if (!queueUrl) {
    console.log('SQS_QUEUE_URL not set.');
    process.exit(1);
    return;
}

if (!sqsRegion) {
    console.log('SQS_REGION not set.');
    process.exit(1);
    return;
}

var sqs = new aws.SQS({ region: sqsRegion });

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */
        if (event.session.application.applicationId !== applicationId) {
             context.fail("Invalid Application ID");
        }

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                },
                function errorCallback(message) {
                    context.fail(message);
                });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
        ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
        ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback, errorCallback) {
    console.log("onIntent requestId=" + intentRequest.requestId + ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // Dispatch to your skill's intent handlers
    if ("BoilIntent" === intentName) {
        console.log('BoilIntent received.');
        command('boil', errorCallback);
        callback({}, buildEmptyResponse(intentName));
    } else if ("BoilAndKeepWarmIntent" === intentName) {
        console.log('BoilAndKeepWarmIntent received.');
        command('boil', errorCallback);
        command('keepwarm', errorCallback);
        callback({}, buildEmptyResponse(intentName));
    } else if ("KeepWarmIntent" === intentName) {
        console.log('KeepWarmIntent received');
        command('keepwarm', errorCallback);
        callback({}, buildEmptyResponse(intentName));
    } else if ("OffIntent" === intentName) {
        console.log('OffIntent received.');
        command('off', errorCallback);
        callback({}, buildEmptyResponse(intentName));
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId + ", sessionId=" + session.sessionId);
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var sessionAttributes = {};
    var cardTitle = "Welcome";
    var speechOutput = "Welcome to iKettle.  You can say things like, boil, keep warm, or turn off.";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    var repromptText = "You can say things like, boil, keep warm, or turn off.";
    var shouldEndSession = false;

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
    var cardTitle = "Session Ended";
    var speechOutput = "Goodbye.";
    // Setting this to true ends the session and exits the skill.
    var shouldEndSession = true;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

function command(commandName, errorCallback) {
    var message = {
        MessageBody: JSON.stringify({ command: commandName }),
        QueueUrl: queueUrl
    };
    
    sqs.sendMessage(message, function (err, data) {
       if (err) {
           var errorMessage = 'Error sending message ' + message.MessageBody + ': ' + err;
           console.log(errorMessage);
           errorCallback(errorMessage);
           return;
       }
       
       console.log('Sent message Id ' + data.MessageId);
    });
}

// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildEmptyResponse(title) {
    var sessionAttributes = {};
    var shouldEndSession = true;
    return buildSpeechletResponse(title, '', null, shouldEndSession);
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}