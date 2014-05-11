expiry-notifier
===============

This is a super lightweight shared nothing service for performing expiry callbacks against a Couchbase bucket where TTL (time to live) are set.   The service provides a list of meta id's and expiry times for keys that will expire within a specified interval.   It runs a simple instance of node.js and is configured exclusively through the REST API.  It can be called dynamically as needed from an application, or configured to loop indefinitely and send the list of keys at a specified interval.   

## Installation
 - [1] Install Node.js
 - [2] Clone this repository
 - [3] From the expiry-notifier directory, run "npm install"
 - [4] Run, "npm start"

## REST API DOCUMENTATION
#### /status [**_RETURNS: {JSON OBJECT} for configured parameters_**] 								
--Retrieves System Status.

#### /setup/server/:server/:port/:bucket	[**_RETURNS: {JSON OBJECT} with status change_**]
--Sets the reference to the Couchbase server and bucket.   

#### /setup/endpoint/:hostname/:port/:path  [**_RETURNS: {JSON OBJECT} with status change_**]
--Sets the endpoint url to send the list of expiring keys to as http://hostname:port/path.  Note: omit any *LEADING* "/" characters in the :path.   
  
#### /setup/poll/:interval/:loop [**_RETURNS: {JSON OBJECT} with status change_**]
--Sets the time window (:interval) in seconds to check for expiring keys.  If :loop is set to "loop", the service will check run indefinitely, checking for expiring keys at the specified :interval. Looping requires endpoint above be defined.  

#### /setup/poll/clear  [**_RETURNS: {JSON OBJECT} with status change_**]
--clears existing looping functionality.  
  
#### /setup/relative/:bool  [**_RETURNS: {JSON OBJECT} with status change_**]
--Sets the timing format returned with each meta id for keys that have expiry within the current polling interval.  Default is UNIX epoch time, the number of seconds from 1/1/1970 when the key will expire.  If relative is set to "true" it will return the number of seconds until the key expires from now.    

#### /poll/:interval [**_RETURNS: {JSON OBJECT} with meta.id, meta.expiry (or if relative set to "true": seconds until expiry)_**]
--Request for applications to dynamically call the service (instead of a looped instance) to return meta id's and expiry times for keys set to expire within the time window (:interval).
   
#### /create/:id/:sessioninfo/:TTL [**_RETURNS: {JSON OBJECT] with session information created_**]
--Creates a session with an id, information, and ttl.  This is a test method as the application server will likely manage session creation and caching.  
   
