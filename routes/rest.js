//----------------------------
// Globals
//----------------------------
var http = require('http');
var couchbase = require('couchbase');
var util = require('util');
var db;
var configured = false;
var endpoint;
var url;
var urlPath;
var port;
var loop = false;
var loopInterval;
var relative = false;
var loopTimer;

//----------------------------
// Create TTL Index
//----------------------------
// This function creates the required Couchbase index
// in order to iterate through keys that have an expiry set.  
// Couchbase uses the unix epoch time, which is the amount
// of seconds since 1/1/1970.   
// This function sets up a dynamic connection to Couchbase 
// from supplied parameters passed in through the REST API.
// The connection is then utilized for all further operations.  
// Setup Connection.
exports.setup = function (req, res) {
	db = new couchbase.Connection({
		host: req.params.host + ":" + req.params.port,
		bucket: req.params.bucket,
		connectionTimeout: '500'
	}, function (err) {
		if (err) {
			console.log('=>DB CONNECTION ERR:', err);
		} else {
			console.log('=>DB CONNECTED');
		}});
  
	// Create index
	var iterator_list = {
			map: ['function(doc, meta) {emit(meta.id,meta.expiration);}'].join('\n ')
		}
    
	// Create Design Document
	var iterator_design = {
		views: {
			iterate_keys: iterator_list
		}};
  
	// Get Existing Design Document, if not exists, add.   Otherwise update.
	db.getDesignDoc("iterator", function (err, ddoc, meta) {
		if (err) {
			console.log("=>BUILD EXPIRY CALLBACK: View Does Not Exist");
			db.setDesignDoc("iterator", iterator_design, function (err) {
				console.log("==>BUILD EXPIRY CALLBACK: Created");
				res.send({
					"status": "index added"
				});});
		} else {
			console.log("=>BUILD EXPIRY CALLBACK: View Exists");
			if (('iterate_keys' in ddoc['views'])) {
				console.log("=>BUILD EXPIRY CALLBACK: Update View");
				ddoc['views']['iterate_keys'] = iterator_list;
				db.setDesignDoc("iterator", ddoc, function (err) {
					if (err) {
						console.log("==>BUILD EXPIRY CALLBACK: Error " + err);
					} else {
						console.log("==>BUILD EXPIRY CALLBACK: Updated");
						res.send({
							"status": "index updated"
						});}});}}});
	configured = true;
}

//----------------------------
// Create Session
//----------------------------
// This is a function to add session data for testing.   This is likely
// not utilized in a production environment as the web tier applications
// will be creating session data in Couchbase.  
exports.create = function (req, res) {
	if (configured) {
		var id = req.params.id;
		var sessioninfo = req.params.sessioninfo;
		var ttl = parseInt(req.params.ttl);
		console.log("==>REST: CREATE");
		console.log("===>:\" ID" + "\":\"" + id + "\"");
		console.log("===>:\" SESSIONINFO" + "\":\"" + sessioninfo + "\"");
		console.log("===>:\" TTL" + "\":\"" + ttl + "\"");
		db.set(id, {
			value: sessioninfo
		}, {
			expiry: ttl
		}, function (err, result) {
			if (err) {
				console.log("====>DB ERR:", err);
			}
			console.log("====>DB RESULT:", result);
			res.send({
				"status": "ID:" + id + " added"
			});});
	} else {
		res.send({
			"status": "Indexing Not Setup"
		});}
}

//----------------------------
// Poll for Callbacks
//----------------------------
// Function for looking for keys that are expiring.  It takes a parameter 
// from the REST API for the interval to search within.  It then iterates through
// the index looking for keys that are expiring within the interval specified.  
//  It will try to visit already expired keys, to expedite deletion from Couchbase.   
// For keys that are within the expiration interval, it builds a JSON object consisting
// of the metaid, and the epoch expiration time.  There is an option to return the 
/// relative time in seconds until expiration.   For example, if a key is expiring in 5 
// minutes,  "300" will be returned.  
exports.poll = function (req, res) {
	if (configured) {
		var callbacks = {};
		var interval = req.params.interval;
		var now = Date.now() / 1000;
		db.view('iterator', 'iterate_keys')
			.query(function (err, results) {
				console.log("POLL====>", new Date().toString());
				console.log("POLL====>ROWCOUNT DOCS:" + results.length);
				for (var _k = 0; _k < results.length; _k++) {
					(function (k) {
						var expiration = Math.ceil((parseInt(results[k].value) - now));
						if (expiration <= interval) {
							if (expiration > 0) {
								console.log("POLL=====>EXPIRING " + results[k].id +
									" IN " + Math.ceil((parseInt(results[k].value) - now)) + " seconds");
								if (relative) {
									callbacks[(results[k].id)] = Math.ceil((parseInt(results[k].value) - now));
								} else {
									callbacks[(results[k].id)] = results[k].value;
								}
							} else {
								db.get(results[k].id, function (err, result) {
									if (err) {
										console.log("POLL=====>LAZY EXPIRE KEY: " + results[k].id +
											" EXPIRED:" + err);
									} else {
										console.log("POLL=====>LAZY EXPIRE KEY: " + results[k].id);
									}});}}})(_k);}
				if (endpoint) {
					callEndpoint(callbacks);
				}
				res.send(callbacks);
			});
	} else {
		res.send({
			"status": "Indexing Not Setup"
		});}
}

//----------------------------
// Loop Callback Query
//----------------------------
// This function implements looping, and calls the polling function 
// until it is cleared.  The parameters are passed in through the REST API
exports.loop = function (req, res) {
	if(req.params.interval.toLowerCase()=="clear"){
		console.log("=>SET LOOP:DISABLED or ENDPOINT NOT SET");
		clearInterval(loopTimer);
		loop = false;
		res.send({
			"status": "loop=disabled"
		});}
	if (req.params.loop.toLowerCase() == "loop" && endpoint) {
		console.log("=>SET LOOP");
		loop = true;
		loopInterval = parseInt(req.params.interval);
		console.log("==>SET LOOP INTERVAL:" + loopInterval);
		// Set Timers
		loopTimer = setInterval(function () {
			exports.poll(req, res);
		}, (loopInterval * 1000));
		res.send({
			"status": "loop=enabled"
		});
	} else {
		console.log("=>SET LOOP:DISABLED or ENDPOINT NOT SET");
		clearInterval(loopTimer);
		loop = false;
		res.send({
			"status": "loop=disabled"
		});}
}

//----------------------------
// Relative selector
//----------------------------
// This function returns relative time instead of epoch unix time
// for polled values that are within the expiration interval.  
exports.relative = function (req, res) {
	if (req.params.option.toLowerCase() == "true") {
		relative = true;
		console.log("=>RELATIVE:ENABLED");
		res.send({
			"status": "relative=" + relative
		});
	} else {
		relative = false;
		console.log("=>RELATIVE:DISABLED");
		res.send({
			"status": "relative=false"
		});}
}

//----------------------------
// Set Endpoint for Callbacks
//----------------------------
// This function sets the Endpoint for sending a JSON object
// of items that are about to expire.   It requires a url, path (url suffix), and tcp
// port as parameters in the REST API.   
exports.endpoint = function (req, res) {
	url = req.params.hostname;
	port = req.params.port;
	urlPath = "\/" + req.params.urlSuffix;
	if (!url || !port || !urlPath) {
		endpoint = null;
		url = null;
		port = null;
		urlPath = null;
		res.send({
			"status": "endpoint=disabled"
		});
	} else {
		endpoint = "enabled";
		console.log("=>ENDPOINT:ENABLED:" + url + ":" + port + urlPath);
		res.send({
			"status": "endpoint=" + url + ":" + port + urlPath
		});}
}

//----------------------------
// System Status
//----------------------------
// Function that returns values for the global variables.  
exports.status = function (req, res) {
	var status = {
		"configured": configured,
		"loop": loop,
		"loopInterval": loopInterval,
		"relative": relative,
		"url": url,
		"port": port,
		"path": urlPath,
		"endpoint": endpoint
	}
	console.log("=>STATUS:", status);
	res.send(status);
}

//----------------------------
// REST Endpoint Caller
//----------------------------
// Function that calls the previously defined endpoint and POSTS
// a JSON object of keys that are within the expiration interval.  
function callEndpoint(stream) {
	var postBody = JSON.stringify(stream);
	console.log("POST ENDPOINT=>BODY:" + postBody);
	var http = require('http');
	var request = new http.ClientRequest({
		hostname: url,
		port: port,
		path: urlPath,
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Content-Length": postBody.length
		}});
	request.end(postBody);
	return;
}