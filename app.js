var express = require('express');
var path = require('path');

var routes = require('./routes/index');
var rest = require('./routes/rest');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.static(path.join(__dirname, 'public')));

app.use('/create/:id/:sessioninfo/:ttl',rest.create);
app.use('/setup/server/:host/:port/:bucket',rest.setup);
app.use('/setup/endpoint/:hostname/:port/:urlSuffix/:https',rest.endpoint);
app.use('/setup/endpoint/:hostname/:port/:urlSuffix/',rest.endpoint);
app.use('/setup/endpoint/:hostname',rest.endpoint);
app.use('/setup/relative/:option',rest.relative);
app.use('/setup/poll/:interval/:loop',rest.loop);
app.use('/setup/poll/:interval',rest.loop);
app.use('/poll/:interval',rest.poll);
app.use('/status',rest.status);

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});
process.on('uncaughtException', function (err) {
    console.log( "UNCAUGHT EXCEPTION " );
    console.log( "[Inside 'uncaughtException' event] " + err.stack || err.message );
});

module.exports = app;

