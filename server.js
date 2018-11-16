const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const SuperAgent = require('superagent');

app.set('port', (process.env.PORT || 5000));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// parse application/json
app.use(bodyParser.json());

var day=0
var month=0
var year=0
var origin=""
var destination=""
var passengerNumber=0
var firstmessage=0
var flightAPI="co489413118494692021956798574785"

function getFlights(options, callback) {
    SuperAgent
    .get(`http://partners.api.skyscanner.net/apiservices/browsequotes/v1.0/TR/TRY/en-us/${options.originPlace}/${options.destinationPlace}/${options.outboundPartialDate}/${options.inboundPartialDate}?apiKey=`+flightAPI)
    .end((err, res) => {
        callback(res.body);
    });
}


app.get('/', function (req, res) {
    if (req.query['hub.verify_token'] === 'EAADl6bx3YVsBAOxhR0jrRBAWx81CnkCkffZBliutL1fb8DaZCgsexiTOZBZBwm1JQ8nGSm3JGZAZCDs8Jbd4HC7CTjfjO0h3Tj2WvmulKdo4osvzXr3gOpqZCET1NVXcjnON3fd4cd1hTPLwkOrmN8IMHZCY8vMqcnyMMp72pTjXgwZDZD') {
        res.send(req.query['hub.challenge'])
    } else {
        res.send('Error, wrong token!!!')
    }
})

app.post('/', function (req, res) {
    var data = req.body;

    if (data.object === 'page') {
        data.entry.forEach(function(entry) {
            var pageID = entry.id;
            var timeOfEvent = entry.time;

            // Iterate over each messaging event
            entry.messaging.forEach(function(event) {
                if (event.message) {
                    receivedMessage(event);
                } else {
                    console.log("Webhook received unknown event: ", event);
                }
            });
        });
        res.sendStatus(200);
    }
});

function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    console.log("Received message for user %d and page %d at %d with message:",
        senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    var messageId = message.mid;

    var messageText = message.text;
    var messageAttachments = message.attachments;

    if (messageText) {
        if(messageText==="#reset") {
            origin=""
            destination=""
            day=0
            year=0
            month=0
            passengerNumber=0
            firstmessage=0
            sendTextMessage(senderID,"Inputs are reset.")
        }
        else
        {
            if(day===0 && month===0 && year ===0&&origin ===""&& destination===""&&passengerNumber===0&&firstmessage===0)
            {
                sendTextMessage(senderID,"Hi,Please enter the destination")
                firstmessage=1
            }
            else if (day===0 && month===0&& year ===0&&origin ===""&& destination===""&&passengerNumber===0){
                destination=messageText
                sendTextMessage(senderID,"Ok.Please enter the origin")
            }
            else if (day===0 && month===0&& year ===0&&origin ===""&&passengerNumber===0){
                origin=messageText
                sendTextMessage(senderID,"Ok.Please enter the year")
            }
            else if (day===0 && month===0 && year ===0&&passengerNumber===0){
                year=parseInt(messageText)
                if(year>=2017 )
                    sendTextMessage(senderID,"Ok.Please enter the month")
                else{
                    sendTextMessage(senderID,"Invalid year.Please enter year again")
                    year=0
                }

            }
            else if (day===0&& month===0 &&passengerNumber===0){
                month=parseInt(messageText)
                if(month>0 || month <13)
                    sendTextMessage(senderID,"Ok.Please enter the day")
                else
                {
                    sendTextMessage(senderID,"Invalid month.Please enter the month again")
                    month=0
                }
            }
            else if (day===0&&passengerNumber===0){
                day=parseInt(messageText)
                if(day>0 || day<31)
                    sendTextMessage(senderID,"Ok. Now please enter the number of passengers")
                else
                {
                    sendTextMessage(senderID,"Invalid day Now please enter the day again.")
                    day=0
                }
            }
            else if (passengerNumber===0)
            {
                var realDay=convertToString(day)
                var realMonth=convertToString(month)
                var realYear=convertToString(year)

                passengerNumber=parseInt(messageText)
                sendTextMessage(senderID,"Thanks for the inputs. We are searching for flights")
                getFlights({
                    originPlace: origin,
                    destinationPlace:destination,
                    outboundPartialDate:realYear+"-"+realMonth+"-"+realDay,
                    inboundPartialDate:""

                }, function (result) {
                    if(result.ValidationErrors)
                    {
                        console.log("Invalid inputs")
                        sendTextMessage(senderID, "Invalid inputs, we couldn't find the flights.")
                    }
                    else
                    {
                        console.log(JSON.stringify(result, null, 4))
                        if(result.Quotes[0]) {
                            var originIndex = 0
                            var destinationIndex = 0
                            var originID = result.Quotes[0].OutboundLeg.OriginId
                            for(var i=0;i<result.Places.length; i++){
                                if(result.Places[i].PlaceId===originID){
                                    originIndex = i
                                    break
                                }
                            }
                            if(originIndex===1){
                                destinationIndex=0
                            }
                            else
                            {
                                destinationIndex=1
                            }
                            var airlineIndex = 0
                            var airlineID = result.Quotes[0].OutboundLeg.CarrierIds[0]
                            for (var j=0; j<result.Carriers.length; j++){
                                if(result.Carriers[j].CarrierId ===airlineID){
                                    airlineIndex = j
                                    break
                                }
                            }
                            var directMessage = ""
                            if(result.Quotes[0].Direct){
                                directMessage ="(Direct Flight)"
                            }
                            else{
                                directMessage = "(Transfer Flight)"
                            }
                            var price = parseInt(result.Quotes[0].MinPrice, 10)
                            sendTextMessage(senderID, "Cheapest flight from " + result.Places[originIndex].Name + " to " + result.Places[destinationIndex].Name
                                +" for "+passengerNumber+ " passenger" + " with " + result.Carriers[airlineIndex].Name + directMessage + " " + convertToString(passengerNumber*price) + " " + result.Currencies[0].Symbol)
                            var directFlag = false
                            var directIndex = 0
                            var directairlineIndex = 0
                            var airlineCode = 0
                            for(var k=0; k<result.Quotes.length; k++){
                                if(result.Quotes[k].Direct){
                                    directIndex = k
                                    directFlag = true
                                    airlineCode = result.Quotes[k].OutboundLeg.CarrierIds[0]
                                    break
                                }
                            }
                            for(var a=0; a<result.Carriers.length; a++){
                                if(result.Carriers[a].CarrierId===airlineCode){
                                    directairlineIndex = a
                                    break
                                }
                            }
                            if(!(result.Quotes[0].Direct) && directFlag){
                                setTimeout(function () {
                                    console.log("Waiting the first message")
                                },1000)
                                sendTextMessage(senderID, "Also there is a direct flight with "+ result.Carriers[directairlineIndex].Name + " for price: "
                                + result.Quotes[directIndex].MinPrice+ " " +result.Currencies[0].Symbol)
                            }
                        }
                        else{
                            sendTextMessage(senderID, "We couldn't find any flight please type the #reset keyword for start again.")
                        }
                    }
                    origin=""
                    destination=""
                    day=0
                    year=0
                    month=0
                    passengerNumber=0
                    firstmessage=0

                })
            }

        }

    } else if (messageAttachments) {
        sendTextMessage(senderID, "Message with attachment received");
    }
}



function convertToString(temp)
{
    var str=""
    if(temp<10)
        str=str+"0"+temp
    else
        str=str+temp
    return str
}

function sendTextMessage(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText
        }
    };

    callSendAPI(messageData);
}

function callSendAPI(messageData) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: 'EAAGWpgIySIABAM0DLkzN0YFkpYYRZBPLmFYZAEKcJ1OcsxMX3rzfLdeZAYaC9XJ1ej2bZBQA26D60u18mEywZCFJZCx4FGJxWQAbDDlVYZClo3H1xqHrKwtZCKPR7UG1KVP4pSZABAap6WSpPyNhlDEhxuMpH2tAZBhA5FxJgQExhYYQZDZD' },
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            console.log("Successfully sent generic message with id %s to recipient %s",
                messageId, recipientId);
        } else {
            console.error("Unable to send message.");
            console.error(response);
            console.error(error);
        }
    });
}



app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})
