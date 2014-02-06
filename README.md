# health-monitor

module for monitor health status by tcp & http connection

[![Build Status](https://secure.travis-ci.org/martinj/node-health-monitor.png)](http://travis-ci.org/martinj/node-health-monitor)

## Installation

	npm install health-monitor

## Examples

	var health = require('health-monitor');

	// single tcp health check
	health.tcp({host: 'localhost', port: 80}, function (err) {
		console.log(err ? 'TCP Service not healthy, reason:' + err.message : 'TCP Service is healthy');
	});

	// single http health check
	health.http({host: 'localhost', port: 8070, path: '/status' }, function (err) {
		console.log(err ? 'HTTP Service not healthy, reason:' + err.message : 'HTTP Service is healthy');
	});

	//continous monitoring
	var stop = health.monitor(['tcp://localhost:80', 'http://localhost:8070/status'], function (err, url) {
		console.log('%s is %s', url, err ? 'unhealthy' : 'healthy');
		//if you want to stop monitoring
		stop();
	});


## Run Tests

	npm test

## Debug

	Add enviroment variable `DEBUG=health-monitor` for debuging output when using the module.