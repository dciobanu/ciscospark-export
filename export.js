/*
  TODO: Retrieve all the messages and not only the last few
  TODO: Download file attachments
  TODO: Need to fix the race condition in mkdir (use the callback)
  TODO: Display download progress bar
*/

'use strict';

const Promise = require("bluebird");
const request = require('request-promise');
const https = require('https');
const fs = require('fs');
const _ = require('underscore');

Promise.config({
    warnings: true,
    longStackTraces: true,
    cancellation: true,
    monitoring: true
});

const OUTPUT_BASEDIR = '/output';
var OUTPUT_DIR;
var contacts = [];
var roomIndex = 0, roomCount = 0;

var token = process.argv[2];

if (!token) {
  console.error('Please supply a valid token in the command line');
  process.exit(1);
}

function toUuid(sparkId) {
  try {
    var b = new Buffer(sparkId, 'base64');
    var s = b.toString();
    return s.split("/").pop();
  } catch(e) {
    console.error('Error parsing Id', sparkId);
    return sparkId;
  }
}

function retrieveMessages(roomId) {
  return request({
      method: 'GET',
      uri: 'https://api.ciscospark.com/v1/messages?roomId=' + roomId,
      auth: {
        'bearer': token
      },
      json: true
  })
  .then( (messages) => {
    _.each(messages.items, (message) => {
      message.id = toUuid(message.id);
      message.roomId = toUuid(message.roomId);
      message.personId = toUuid(message.personId);

      if (message.mentionedPeople) {
        for(var i in message.mentionedPeople) {
          message.mentionedPeople[i] = toUuid(message.mentionedPeople[i]);
        }
      }
    });
    fs.writeFile(OUTPUT_DIR + '/room_' + roomId + '_messages.json', JSON.stringify(messages, null, 4));
  })
  .catch( (err) => {
    console.error('Error downloading messages in room', roomId);
    console.error(err);
  });
}

function retrieveMemberships(roomId) {
  return request({
      method: 'GET',
      uri: 'https://api.ciscospark.com/v1/memberships?roomId=' + roomId,
      auth: {
        'bearer': token
      },
      json: true
  }).then( (memberships) => {
    _.each(memberships.items, (membership) => {
      membership.roomId = toUuid(membership.roomId);
      membership.personId = toUuid(membership.personId);
      if (!_.findWhere(contacts, {personId: membership.personId})) {
        contacts.push(_.pick(membership, 'personId', 'personEmail', 'personDisplayName'));
      }
    });
    fs.writeFile(OUTPUT_DIR + '/room_' + roomId + '_memberships.json', JSON.stringify(memberships, null, 4));
  })
  .catch( (err) => {
    console.error('Error downloading memberships in room', roomId);
    console.error(err);
  });
}


request({
    method: 'GET',
    uri: 'https://api.ciscospark.com/v1/people/me',
    auth: {
      'bearer': token
    },
    json: true
})
.then( (me) => {
  me.id = toUuid(me.id);
  me.orgId = toUuid(me.orgId);

  console.log('Dowloading the data for', me.displayName);
  OUTPUT_DIR = OUTPUT_BASEDIR + '/' + me.displayName;
  fs.mkdir(OUTPUT_DIR, (err) => {
    if (err.code === 'EEXIST') {
      console.warn(OUTPUT_DIR, 'already exists');
    }
    else {
      console.error('Creating folder failed', err);
      throw err;
    }
  });
  fs.writeFile(OUTPUT_DIR + '/me.json', JSON.stringify(me, null, 4));

  var file = fs.createWriteStream(OUTPUT_DIR + '/avatar.png');
  https.get(me.avatar, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close();
    });
  });

  console.log('Retrieving the list of rooms ...');
  return request({
      method: 'GET',
      uri: 'https://api.ciscospark.com/v1/rooms?max=10000',
      auth: {
        'bearer': token
      },
      json: true
  });
})
.then( (rooms) => {
  roomCount = rooms.items.length;
  console.log('Downloading content for', roomCount, 'rooms');
  _.each(rooms.items, (room) => {
    room.id = toUuid(room.id);
    room.creatorId = toUuid(room.creatorId);
  });
  fs.writeFile(OUTPUT_DIR + '/rooms.json', JSON.stringify(rooms, null, 4));
  console.log('List stored. Now retrieving content of each room');

  return rooms.items;
})
.catch( (err) => {
  console.error('Error', err.message);
})
.each( (room) => {
  roomIndex++;
  console.log('Loading room', roomIndex, 'from', roomCount);
  return retrieveMessages(room.id).then(retrieveMemberships(room.id));
})
.then( () => {
  fs.writeFile(OUTPUT_DIR + '/contacts.json', JSON.stringify(contacts, null, 4));
})
