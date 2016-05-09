/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:true */
// Leave the above lines for propper jshinting
//Type Node.js Here :)

var hx711 = require('jsupm_hx711');// Instantiate a HX711 data on digital pin D3 and clock on digital pin D2

// Ardurino
var DATA_SHIELD = 3; // Arduino shield
var CLOCK_SHIELD = 2; // Arduino shield

// MRAA
var DATA_MRAA = 20; // GPIO block GP12
var CLOCK_MRAA = 13; // GPIO block GP128

var scale = new hx711.HX711(DATA_SHIELD, CLOCK_SHIELD);
var calibrationFactor = 910.0; // Seeed Studio 5kg load cell

// To send to Intel IoT Analytics
var dgram = require('dgram');
var client = dgram.createSocket('udp4');

// LCD
var util = require('util');
var mraa = require('mraa');
var version = mraa.getVersion();
console.log('mraa version (' + version + ')');


// UDP Options
var options = {
    host : '127.0.0.1',
    port : 41234
};

setupHX711();

periodicActivity();

// Call to setup device
function setupHX711() {
    console.log("Setup HX711...");

    scale.setScale(calibrationFactor);
    
    console.log("... call tare()");

    scale.tare(20);
    scale.tare(20); // Second read to clear bad reads
    
    // Register sensor
    var data = [
        {
            sensorName: "scale",
            sensorType: "scale.v1.0"
        }
    ];
    data.forEach(function(item) {
        registerNewSensor(item.sensorName, item.sensorType, function () {
            console.log("Registering: " + item.sensorName);
            });
    });
}

function periodicActivity() { 
    var rawUnits = scale.getUnits();
    
    if (rawUnits <= 5.0 || rawUnits > 4000000) {
        units = 0;
    } else if (rawUnits > 1000.0) {
        unit = 1000.0;
    } else {
        units = Math.round(rawUnits);
    }

    console.log("Reading: " + rawUnits + ", " + units + " g");
    
    // Prepare readings to send
    var data = [
        {
            sensorName: "scale",
            sensorType: "scale.v1.0",
            observations: [
                {
                    on: new Date().getTime(),
                    value: units
                }
            ]
        }
    ];
    
    // Send to Intel IoT Analytics cloud
    data.forEach(function(item) {
        item.observations.forEach(function (observation) {
            sendObservation(item.sensorName, observation.value, observation.on);
        });

    });
    
    setTimeout(periodicActivity, 5000);
}

function registerNewSensor(name, type, callback){
    var msg = JSON.stringify({
        n: name,
        t: type
    });

    var sentMsg = new Buffer(msg);
    console.log("Registering sensor: " + sentMsg);
    client.send(sentMsg, 0, sentMsg.length, options.port, options.host, callback);
};

function sendObservation(name, value, on){
    var msg = JSON.stringify({
        n: name,
        v: value,
        on: on
    });

    var sentMsg = new Buffer(msg);
    console.log("Sending observation: " + sentMsg);
    client.send(sentMsg, 0, sentMsg.length, options.port, options.host);
};

client.on("message", function(mesg, rinfo){
    console.log('UDP message from %s:%d', rinfo.address, rinfo.port);
    var a = JSON.parse(mesg);
    console.log(" m ", JSON.parse(mesg));

    if (a.b == 5) {
        client.send(message, 0, message.length, PORT, HOST, function(err, bytes) {
            if (err) throw err;
            console.log('UDP message sent to ' + HOST +':'+ PORT);
            // client.close();

        });
    }
});