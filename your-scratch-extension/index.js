const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const TargetType = require('../../extension-support/target-type');


//////////////////////////////////////////////////////
//                 WS connection
//////////////////////////////////////////////////////
var wsIsConnected = false;
var wsGateway = "";
var Sensors = [0, 0, 0, 0, 0, 0, 0, 0];
var lastLeftMotor = -1;
var lastRightMotor = -1;
var lastServo1 = -1;
var lastServo2 = -1;
var lastServo1Speed = -1;
var lastServo2Speed = -1;
var lastScreenMsg = "";
var lastSentCommand = "";

function initWebSocket() {
    console.log('Trying to open a WebSocket connection on: ' + wsGateway);

    try {
        websocket = new WebSocket(wsGateway);
        websocket.onopen = onOpen;
        websocket.onclose = onClose;
        websocket.onmessage = onMessage; // <-- add this line
    } catch (_unused) {
        console.log("Connection failed. Will retry in a while");
        setTimeout(initWebSocket, 2000);
    }

    return wsIsConnected;
}

function onOpen(event) {
    wsIsConnected = true;
    console.log('Connection opened');
}

function onClose(event) {
    wsIsConnected = false;
    console.log('Connection closed');
    setTimeout(initWebSocket, 2000);
}

function onMessage(event) {
    // console.log("ws message"); // to much logging
    var str = "";
    str = event.data;

    if (str.startsWith("s")) {
        var sensors = str.split(":");

        for (var i = 1; i < sensors.length; i++) {
            Sensors[i - 1] = parseFloat(sensors[i]);
        }
    }
}

function sendCommand(COMMAND) {
    if (lastSentCommand == COMMAND) return true; // example implementation to return a string

    console.log("sendCommand(" + COMMAND + ")");

    try {
        if (wsIsConnected) {
            websocket.send(COMMAND);
            lastSentCommand = COMMAND;
            return true;
        }
    } catch (_unused2) {
        console.log("Couldn't send: " + COMMAND);
    }

    return false;
}

//////////////////////////////////////////////////////
//                 BLE connection
//////////////////////////////////////////////////////
var bleIsConnected = false;


// Validate services UUID entered by user first.
var m3DScratchServiceUUID = "8e088cd2-8000-11ee-b9d1-0242ac120002";

var proximityAUUID = "8e088cd2-7001-11ee-b9d1-0242ac120002";
var proximityBUUID = "8e088cd2-7002-11ee-b9d1-0242ac120002";
var distanceUUID = "8e088cd2-7003-11ee-b9d1-0242ac120002";
var leftMotorUUID = "8e088cd2-6001-11ee-b9d1-0242ac120002";
var rightMotorUUID = "8e088cd2-6002-11ee-b9d1-0242ac120002";
var servoAAngleUUID = "8e088cd2-6003-11ee-b9d1-0242ac120002";
var servoBAngleUUID = "8e088cd2-6004-11ee-b9d1-0242ac120002";
var servoASpeedUUID = "8e088cd2-6005-11ee-b9d1-0242ac120002";
var servoBSpeedUUID = "8e088cd2-6006-11ee-b9d1-0242ac120002";
var expressionUUID = "8e088cd2-6007-11ee-b9d1-0242ac120002";
var textMessageUUID = "8e088cd2-6008-11ee-b9d1-0242ac120002";

var leftMotorCharacteristic;
var rightMotorCharacteristic;
var servoAAngleCharacteristic;
var servoBAngleCharacteristic;
var servoASpeedCharacteristic;
var servoBSpeedCharacteristic;
var expressionCharacteristic;
var textMessageCharacteristic;

function writeBLEFloat(characteristic, floatValue) {
    if (!characteristic) {
        console.log("Characteristic invalid");
        return;
    }
    if (!characteristic.properties.write) {
        console.log("Characteristic not writable");
        return;
    }
    // Convert float value to ArrayBuffer
    let buffer = new ArrayBuffer(4); // 4 bytes for a single float (Float32)
    let dataView = new DataView(buffer);
    dataView.setFloat32(0, floatValue, true); // true for little-endian encoding (adjust based on your system)

    // Write the ArrayBuffer to the characteristic
    characteristic
        .writeValue(buffer)
        .then(() => {
            //console.log("Sent float value:", floatValue);
        })
        .catch((error) => {
            //console.error("Error sending float value:", error);
        });
}
function writeBLEString(characteristic, stringToSend) {
    if (!characteristic) {
        // console.log("Characteristic invalid");
        return;
    }
    if (!characteristic.properties.write) {
        // console.log("Characteristic not writable");
        return;
    }
    // Convert the string to an ArrayBuffer
    let encoder = new TextEncoder('utf-8');
    let encodedString = encoder.encode(stringToSend);

    // Write the value to the characteristic
    characteristic.writeValue(encodedString)
        .then(() => {
            // console.log('Sent string:', stringToSend);
        })
        .catch(error => {
            // console.error('Error sending string:', error);
        });
}
function setLeftMotor(value) {
    writeBLEFloat(leftMotorCharacteristic, value / 100);
}
function setRightMotor(value) {
    writeBLEFloat(rightMotorCharacteristic, value / 100);
}
function setServoAAngle(value) {
    writeBLEFloat(servoAAngleCharacteristic, value);
}
function setServoBAngle(value) {
    writeBLEFloat(servoBAngleCharacteristic, value);
}
function setServoASpeed(value) {
    writeBLEFloat(servoASpeedCharacteristic, value);
}
function setServoBSpeed(value) {
    writeBLEFloat(servoBSpeedCharacteristic, value);
}
function setExpresssion(expression) {
    writeBLEString(expressionCharacteristic, expression);
}
function setTextMessage(text) {
    writeBLEString(textMessageCharacteristic, text);
}
function proximityACharacteristicChangeHandler(event) {
    var value = event.target.value;
    var floatValue = new Float32Array(value.buffer)[0];
    // console.log("Received proximity A: ", floatValue);
    Sensors[0] = floatValue;
}
function proximityBCharacteristicChangeHandler(event) {
    var value = event.target.value;
    var floatValue = new Float32Array(value.buffer)[0];
    // console.log("Received proximity B: ", floatValue);
    Sensors[1] = floatValue;
}
function distancCharacteristicChangeHandler(event) {
    var value = event.target.value;
    var floatValue = new Float32Array(value.buffer)[0];
    // console.log("Received distance: ", floatValue);
    Sensors[2] = floatValue;
}
function initBLE() {
    console.log("begin");
    console.log("Requesting any Bluetooth Device...");
    navigator.bluetooth
        .requestDevice({
            acceptAllDevices: false,
            filters: [{ services: [m3DScratchServiceUUID] }],
        })
        .then((device) => {
            console.log("Connecting to GATT Server...");
            return device.gatt.connect();
        })
        .then((server) => {
            // Note that we could also get all services that match a specific UUID by
            // passing it to getPrimaryServices().
            console.log("Getting Services...");
            return server.getPrimaryService(m3DScratchServiceUUID);
        })
        .then((service) => {
            console.log("Setting up characteristics watch");
            bleIsConnected = true;
            service.getCharacteristic(proximityAUUID).then((ch) => {
                console.log("Got: proximityA characteristic");
                proximityCharacteristic = ch;
                ch.startNotifications().then((_) => {
                    console.log("");
                    ch.addEventListener(
                        "characteristicvaluechanged",
                        proximityACharacteristicChangeHandler
                    );
                });
                service.getCharacteristic(proximityBUUID).then((ch) => {
                    console.log("Got: proximityB characteristic");
                    proximityCharacteristic = ch;
                    ch.startNotifications().then((_) => {
                        console.log("");
                        proximityCharacteristic.addEventListener(
                            "characteristicvaluechanged",
                            proximityBCharacteristicChangeHandler
                        );
                    });
                    service.getCharacteristic(distanceUUID).then((ch) => {
                        console.log("Got: distance characteristic");
                        distancCharacteristic = ch;
                        ch.startNotifications().then((_) => {
                            console.log("");
                            distancCharacteristic.addEventListener(
                                "characteristicvaluechanged",
                                distancCharacteristicChangeHandler
                            );
                        });
                        service.getCharacteristic(leftMotorUUID).then((ch) => {
                            console.log("Got: leftMotor characteristic");
                            leftMotorCharacteristic = ch;
                            service.getCharacteristic(rightMotorUUID).then((ch) => {
                                console.log("Got: rightMotor characteristic");
                                rightMotorCharacteristic = ch;
                                service.getCharacteristic(servoAAngleUUID).then((ch) => {
                                    console.log("Got: servoAAngle characteristic");
                                    servoAAngleCharacteristic = ch;
                                    service.getCharacteristic(servoBAngleUUID).then((ch) => {
                                        console.log("Got: servoBAngle characteristic");
                                        servoBAngleCharacteristic = ch;
                                        service.getCharacteristic(servoASpeedUUID).then((ch) => {
                                            console.log("Got: servoASpeed characteristic");
                                            servoASpeedCharacteristic = ch;
                                            service.getCharacteristic(servoBSpeedUUID).then((ch) => {
                                                console.log("Got: servoBSpeed characteristic");
                                                servoBSpeedCharacteristic = ch;
                                                service.getCharacteristic(expressionUUID).then((ch) => {
                                                    console.log("Got: expression characteristic");
                                                    expressionCharacteristic = ch;
                                                    service.getCharacteristic(textMessageUUID).then((ch) => {
                                                        console.log("Got: textMessage characteristic");
                                                        textMessageCharacteristic = ch;
                                                        alert('M3D Go connected!');
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
            return Promise.resolve();
        })
        .catch((error) => {
            console.log("Argh! " + error);
        });
}


//////////////////////////////////////////////////////
//                 Common
//////////////////////////////////////////////////////
function GoIsConnected() {
    if (wsIsConnected === null)
        wsIsConnected = false;
    if (bleIsConnected === null)
        bleIsConnected = false;
    return wsIsConnected || bleIsConnected;
}
function sendLeftMotorCommand(power) {
    if (lastLeftMotor == power)
        return true;

    if (bleIsConnected) {
        lastLeftMotor = power;
        setLeftMotor(power);
        return true;
    }
    else {
        if (sendCommand("lm " + power + "%")) {
            lastLeftMotor = power;
            return true;
        }
    }
    return false;
}

function sendRightMotorCommand(power) {
    if (lastRightMotor == power)
        return true;

    if (bleIsConnected) {
        lastRightMotor = power;
        setRightMotor(power);
        return true;
    }
    else {
        if (sendCommand("rm " + power + "%")) {
            lastRightMotor = power;
            return true;
        }
    }
    return false;
}
function sendServo1Command(angle) {

    if (lastServo1 == angle)
        return true;
    if (bleIsConnected) {
        lastServo1 = angle;
        setServoAAngle(angle);
        return true;
    }
    else {
        if (sendCommand("servo 1 " + angle))
            lastServo1 = angle;
        return true;
    }
}
function sendServo2Command(angle) {

    if (lastServo2 == angle) 
        return true;
    if (bleIsConnected) {
        lastServo2 = angle;
        setServoBAngle(angle);
        return true;
    }
    else {
        if (sendCommand("servo 2 " + angle))
            lastServo2 = angle;
        return true;
    }
}
function sendServo1SpeedCommand(speed) {

    if (lastServo1Speed == speed)
        return true;
    if (bleIsConnected) {
        lastServo1Speed = speed;
        setServoASpeed(speed);
        return true;
    }
    else {
        if (sendCommand("servo 1 " + speed))
            lastServo1Speed = speed;
        return true;
    }
}
function sendServo2SpeedCommand(speed) {

    if (lastServo2Speed == speed)
        return true;
    if (bleIsConnected) {
        lastServo2Speed = speed;
        setServoBSpeed(speed);
        return true;
    }
    else {
        if (sendCommand("servo 2 " + speed))
            lastServo2Speed = speed;
        return true;
    }
}
function sendExpressionCommand(expression) {
    var com = "express " + expression;
    if (lastScreenMsg == com) 
        return true;
    if (bleIsConnected) {
        lastScreenMsg = com;
        setExpresssion(expression);
        return true;
    }
    else {
        if (sendCommand(com)) 
            lastScreenMsg = com;
        return true;
    }
}
function sendTextMessageCommand(text) {
    var com = "show " + text;
    if (lastScreenMsg == com) 
        return true;
    if (bleIsConnected) {
        lastScreenMsg = com;
        setTextMessage(text);
        return true;
    }
    else {
        if (sendCommand(com)) 
            lastScreenMsg = com;
        return true;
    }
}
class Scratch3YourExtension {

    constructor(runtime) {
        // put any setup for your extension here
    }

    /**
     * Returns the metadata about your extension.
     */
    getInfo() {
        return {
            // unique ID for your extension
            id: 'yourScratchExtension',

            // name that will be displayed in the Scratch UI
            name: 'M3D Go',

            // colours to use for your extension blocks
            color1: '#c00707',
            color2: '#fff000',

            // icons to display
            blockIconURI: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFk2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDggNzkuMTY0MDM2LCAyMDE5LzA4LzEzLTAxOjA2OjU3ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0ZURhdGU9IjIwMjMtMDgtMjFUMDE6MjQ6NTIrMDU6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDIzLTA4LTIxVDAxOjI2OjUwKzA1OjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIzLTA4LTIxVDAxOjI2OjUwKzA1OjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9InNSR0IgSUVDNjE5NjYtMi4xIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjZkMDY5ZjYyLTFjN2MtZjY0Yi1iYmU5LTNlZWJlMmI4Yjc1MCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo2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',
            menuIconURI: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFk2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDggNzkuMTY0MDM2LCAyMDE5LzA4LzEzLTAxOjA2OjU3ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0ZURhdGU9IjIwMjMtMDgtMjFUMDE6MjQ6NTIrMDU6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDIzLTA4LTIxVDAxOjI2OjUwKzA1OjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIzLTA4LTIxVDAxOjI2OjUwKzA1OjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9InNSR0IgSUVDNjE5NjYtMi4xIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjZkMDY5ZjYyLTFjN2MtZjY0Yi1iYmU5LTNlZWJlMmI4Yjc1MCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo2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',

            // your Scratch blocks
            blocks: [{
                opcode: 'checkConnectedBlock',
                // type of block - choose from:
                //   BlockType.REPORTER - returns a value, like "direction"
                //   BlockType.BOOLEAN - same as REPORTER but returns a true/false value
                //   BlockType.COMMAND - a normal command block, like "move {} steps"
                //   BlockType.HAT - starts a stack if its value changes from false to true ("edge triggered")
                blockType: BlockType.BOOLEAN,
                text: 'M3D Go is connected',
                terminal: true,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {// type/shape of the parameter - choose from:
                    //     ArgumentType.ANGLE - numeric value with an angle picker
                    //     ArgumentType.BOOLEAN - true/false value
                    //     ArgumentType.COLOR - numeric value with a colour picker
                    //     ArgumentType.NUMBER - numeric value
                    //     ArgumentType.STRING - text value
                    //     ArgumentType.NOTE - midi music value with a piano picker
                }
            }, {
                opcode: 'connectRequestBlock',
                blockType: BlockType.COMMAND,
                text: 'Connect M3D Go at [MY_ADDRESS]',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    MY_ADDRESS: {
                        defaultValue: '192.168.10.27',
                        type: ArgumentType.STRING
                    }
                }
            }, {
                opcode: 'connectRequestBlockBLE',
                blockType: BlockType.COMMAND,
                text: 'Connect M3D Go with Bluetooth',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                }
            },
            // {
            //     opcode: 'sendRawCommandBlock',
            //     blockType: BlockType.COMMAND,
            //     text: 'Send Command [COMMAND]',
            //     terminal: false,
            //     filter: [TargetType.SPRITE, TargetType.STAGE],
            //     arguments: {
            //         COMMAND: {
            //             defaultValue: 'Hello!',
            //             type: ArgumentType.STRING
            //         }
            //     }
            // },
            {
                // name of the function where your block code lives
                opcode: 'goFwd',
                blockType: BlockType.COMMAND,
                text: 'Go forward',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {}
            }, {
                // name of the function where your block code lives
                opcode: 'goBwd',
                blockType: BlockType.COMMAND,
                text: 'Go backward',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {}
            }, {
                // name of the function where your block code lives
                opcode: 'halt',
                blockType: BlockType.COMMAND,
                text: 'Stop',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {}
            }, {
                opcode: 'goFwdAtSpeed',
                blockType: BlockType.COMMAND,
                text: 'Go forward at [POWER]%',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    POWER: {
                        defaultValue: '80',
                        type: ArgumentType.NUMBER
                    }
                }
            }, {
                opcode: 'goBwdAtSpeed',
                blockType: BlockType.COMMAND,
                text: 'Go backward at [POWER]%',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    POWER: {
                        defaultValue: '80',
                        type: ArgumentType.NUMBER
                    }
                }
            }, {
                // name of the function where your block code lives
                opcode: 'rotateCW',
                blockType: BlockType.COMMAND,
                text: 'Rotate clockwise',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {}
            }, {
                // name of the function where your block code lives
                opcode: 'rotateCCW',
                blockType: BlockType.COMMAND,
                text: 'Rotate counter-clockwise',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {}
            }, {
                opcode: 'rotateCWAtSpeed',
                blockType: BlockType.COMMAND,
                text: 'Rotate clockwise at [POWER]%',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    POWER: {
                        defaultValue: '80',
                        type: ArgumentType.NUMBER
                    }
                }
            }, {
                opcode: 'rotateCCWAtSpeed',
                blockType: BlockType.COMMAND,
                text: 'Rotate counter-clockwise at [POWER]%',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    POWER: {
                        defaultValue: '80',
                        type: ArgumentType.NUMBER
                    }
                }
            }, {
                opcode: 'setLeftMotorSpeed',
                blockType: BlockType.COMMAND,
                text: 'Set left motor at [POWER]%',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    POWER: {
                        defaultValue: '80',
                        type: ArgumentType.NUMBER
                    }
                }
            }, {
                opcode: 'setRightMotorSpeed',
                blockType: BlockType.COMMAND,
                text: 'Set right motor at [POWER]%',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    POWER: {
                        defaultValue: '80',
                        type: ArgumentType.NUMBER
                    }
                }
            }, {
                opcode: 'readIR0',
                blockType: BlockType.REPORTER,
                text: 'IR sensor 1 value',
                terminal: true,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {}
            }, {
                opcode: 'readIR1',
                blockType: BlockType.REPORTER,
                text: 'IR sensor 2 value',
                terminal: true,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {}
            }, {
                opcode: 'readRange',
                blockType: BlockType.REPORTER,
                text: 'Range finder value',
                terminal: true,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {}
            }, {
                opcode: 'setServo1Angle',
                blockType: BlockType.COMMAND,
                text: 'Set servo 1 angle [ANGLE] degree',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    ANGLE: {
                        defaultValue: '0',
                        type: ArgumentType.NUMBER
                    }
                }
            }, {
                opcode: 'setServo2Angle',
                blockType: BlockType.COMMAND,
                text: 'Set servo 2 angle [ANGLE] degree',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    ANGLE: {
                        defaultValue: '0',
                        type: ArgumentType.NUMBER
                    }
                }
            }, {
                opcode: 'setServo1Speed',
                blockType: BlockType.COMMAND,
                text: 'Set servo 1 speed [SPEED] %',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    SPEED: {
                        defaultValue: '20',
                        type: ArgumentType.NUMBER
                    }
                }
            }, {
                opcode: 'setServo2Speed',
                blockType: BlockType.COMMAND,
                text: 'Set servo 2 speed [SPEED] %',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    SPEED: {
                        defaultValue: '20',
                        type: ArgumentType.NUMBER
                    }
                }
            }, {
                opcode: 'setExpression',
                blockType: BlockType.COMMAND,
                text: 'Express [EXPRESSION]',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    EXPRESSION: {
                        defaultValue: 'smile',
                        type: ArgumentType.STRING,
                        menu: 'expressionsMenu'
                    }
                }
            }, {
                opcode: 'showText',
                blockType: BlockType.COMMAND,
                text: 'Show text [TEXT]',
                terminal: false,
                filter: [TargetType.SPRITE, TargetType.STAGE],
                arguments: {
                    TEXT: {
                        defaultValue: 'Hello!',
                        type: ArgumentType.STRING
                    }
                }
            }],
            menus: {
                expressionsMenu: {
                    items: ["smile", "confused", "frustrated", "funny", "joy", "laugh", "like", "love", "wink", "stuck"]
                }
            }
        };
    }


    /**
     * implementation of the block with the opcode that matches this name
     *  this will be called when the block is used
     */
    checkConnectedBlock({ }) {
        //console.log("checkConnectedBlock()");
        return GoIsConnected();
    }
    connectRequestBlock({ MY_ADDRESS }) {
        MY_ADDRESS = "ws://" + MY_ADDRESS + "/ws";
        console.log("connectRequestBlock(" + MY_ADDRESS + ")");
        if (wsGateway !== MY_ADDRESS) {
            wsGateway = MY_ADDRESS;
            if (wsIsConnected) {
                console.log("disconnecting previous one");
                onclose = null;
                websocket.close()
            }
            initWebSocket();
        }
        return wsIsConnected;
    }
    connectRequestBlockBLE({ }) {
        console.log("connectRequestBlockBLE()");
        initBLE();
        return bleIsConnected;
    }
    // sendRawCommandBlock({ COMMAND }) {
    //     if (!wsIsConnected)
    //         return false;
    //     return sendCommand(COMMAND);
    // }
    // Movement
    goFwd({ }) {
        if (!GoIsConnected())
            return false;
        sendLeftMotorCommand(100);
        sendRightMotorCommand(100);
        return true;
    }
    goBwd({ }) {
        if (!GoIsConnected())
            return false;
        sendLeftMotorCommand(-100);
        sendRightMotorCommand(-100);
        return true;
    }
    halt({ }) {
        if (!GoIsConnected())
            return false;
        sendLeftMotorCommand(0);
        sendRightMotorCommand(0);
        return true;
    }
    goFwdAtSpeed({ POWER }) {
        if (!GoIsConnected())
            return false;
        sendLeftMotorCommand(POWER);
        sendRightMotorCommand(POWER);
        return true;
    }
    goBwdAtSpeed({ POWER }) {
        if (!GoIsConnected())
            return false;
        sendLeftMotorCommand(-POWER);
        sendRightMotorCommand(-POWER);
        return true;
    }
    rotateCW({ }) {
        if (!GoIsConnected())
            return false;
        sendLeftMotorCommand(100);
        sendRightMotorCommand(-100);
        return true;
    }
    rotateCCW({ }) {
        if (!GoIsConnected())
            return false;
        sendLeftMotorCommand(-100);
        sendRightMotorCommand(100);
        return true;
    }
    rotateCWAtSpeed({ POWER }) {
        if (!GoIsConnected())
            return false;
        sendLeftMotorCommand(POWER);
        sendRightMotorCommand(-POWER);
        return true;
    }
    rotateCCWAtSpeed({ POWER }) {
        if (!GoIsConnected())
            return false;
        sendLeftMotorCommand(-POWER);
        sendRightMotorCommand(POWER);
        return true;
    }
    setLeftMotorSpeed({ POWER }) {
        if (!GoIsConnected())
            return false;
        sendLeftMotorCommand(-POWER);
        return true;
    }
    setRightMotorSpeed({ POWER }) {
        if (!GoIsConnected())
            return false;
        sendRightMotorCommand(-POWER);
        return true;
    }
    readIR0({ }) {
        if (!GoIsConnected())
            return false;
        //console.log("readIR0()");
        // read the cache and return
        return Sensors[0];
    }
    readIR1({ }) {
        if (!GoIsConnected())
            return false;
        //console.log("readIR1(0");
        // read the cache and return
        return Sensors[1];
    }
    readRange({ }) {
        if (!GoIsConnected())
            return false;
        console.log("readRange()");
        // read the cache and return
        return Sensors[2];
    }
    setServo1Angle({ ANGLE }) {
        if (!GoIsConnected())
            return false;
        sendServo1Command(ANGLE);
    }
    setServo2Angle({ ANGLE }) {
        if (!GoIsConnected())
            return false;
        sendServo2Command(ANGLE);
    }
    setServo1Speed({ SPEED }) {
        if (!GoIsConnected())
            return false;
        sendServo1SpeedCommand(SPEED);
    }
    setServo2Speed({ SPEED }) {
        if (!GoIsConnected())
            return false;
        sendServo2SpeedCommand(SPEED);
    }
    setExpression({ EXPRESSION }) {
        if (!GoIsConnected())
            return false;
        sendExpressionCommand(EXPRESSION);
    }
    showText({ TEXT }) {
        if (!GoIsConnected())
            return false;
        sendTextMessageCommand(TEXT);
    }
}

module.exports = Scratch3YourExtension;
