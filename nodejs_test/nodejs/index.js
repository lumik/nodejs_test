// index.js

var http = require('http');
var server = http.createServer().listen(4000, function() {console.log('listening on *:4000');});
var io = require('socket.io').listen(server);
var cookie_reader = require('cookie');
var querystring = require('querystring');

var redis = require('redis');
// By default, redis.createClient() will use 127.0.0.1 and 6379 as the hostname and port respectively.
// If you have a different host/port you can supply them as following:
// var sub = redis.createClient(port, host);
var sub = redis.createClient();
var handshakeData;
var id = 0;

//Subscribe to the Redis chat channel
sub.subscribe('chat');

// this function is called on each new connection
io.use(function(socket, next) {
    console.log('authorization check')
    handshakeData = socket.request;
    if(handshakeData.headers.cookie){
        handshakeData.cookie = cookie_reader.parse(handshakeData.headers.cookie);
        next();
    } else {
        next(new Error('not authorized'))
    }
});

io.on('connection', function (socket) {
    console.log('a user connected');
    socket.on('disconnect', function(){
       console.log('user disconnected');
    });

    //Grab message from Redis and send to client
    sub.on('message', function(channel, message){
        socket.send(message);
    });

    //Client is sending message through socket.io
    socket.on('send_message', function (msg) {
        /* var values = querystring.stringify({
            comment: msg.comment,
            sessionid: msg.sessionid
        }); */
        var values = querystring.stringify({
            comment: msg,
            sessionid: handshakeData.cookie['sessionid']
        });

        var options = {
            host: 'nodejs_test',
            port: 80,
            path: '/node_api',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': values.length,
                'cookie': 'csrftoken=' + handshakeData.cookie['csrftoken'] + '; sessionid='
                                       + handshakeData.cookie['sessionid'],
                'X-CSRFToken': handshakeData.cookie['csrftoken']
            }
        };

        //Send message to Django server
        var req = http.request(options, function(res){
            res.setEncoding('utf8');

            //Print out error message
            res.on('data', function(message){
                if(message != 'Everything worked :)'){
                    console.log('Message: ' + message);
                }
            });
        });

        req.write(values);
        req.end();
    });
});
