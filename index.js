'use strict';
var http = require('http'),
	net = require('net'),
	urlParse = require('url').parse,
	debug = require('debug')('health-monitor');

function error(msg, code) {
	var e = new Error(msg);
	e.code = code;
	return e;
}

/**
 * Check with http request
 * @param  {Object} opts
 * @param  {Object} opts.host
 * @param  {Object} opts.port
 * @param  {Object} opts.path
 * @param  {Object} [opts.method] http method, default HEAD
 * @param  {Object} [opts.timeout] Connect timeout for poll in ms. default 500
 * @param  {Function} cb   fn(err) - if !err then its healthy
 */
module.exports.http = function (opts, cb) {
	var timeoutId = null,
		method = opts.method || 'HEAD',
		timedout = false;

	var req = http.request({ method: method, host: opts.host, port: opts.port, path: opts.path }, function (res) {
		if (res.socket) { //this check is here only for unittesting to work.
			res.socket.destroy();
		}
		if (res.statusCode === 200) {
			return cb(null);
		}
		cb(error('Unexpected HTTP status code ' + res.statusCode, 'INVALIDSTATUSCODE'));
	});

	req.on('error', function (e) {
		if (timedout) {
			return;
		}
		clearTimeout(timeoutId);
		debug('http health check failed with error on http://%s:%s %s ', opts.host, opts.port, e);
		cb(e);
	});

	req.on('socket', function (socket) {
		socket.on('connect', function () {
			clearTimeout(timeoutId);
		});
	});

	timeoutId = setTimeout(function () {
		debug('http health check on http://%s:%s timedout', opts.host, opts.port);
		timedout = true;
		//abort will trigger error event on request ECONNRESET, thats why we use timedout var.
		req.abort();
		cb(error('Connect timeout', 'CONNECTTIMEOUT'));
	}, opts.timeout || 500);

	req.end();
};

/**
 * Check health with tcp connect
 * @param  {Object} [opts]
 * @param  {Object} opts.host
 * @param  {Object} opts.port
 * @param  {Object} [opts.timeout] Connect timeout for poll in ms. default 500
 * @param  {Function} cb   fn(healty, url, cause)
 */
module.exports.tcp = function (opts, cb) {
	var socket = new net.Socket(),
		timeoutId = null,
		timedout = false;

	socket.on('error', function (e) {
		if (timedout) {
			return;
		}
		debug('tcp health check on %s:%s timedout', opts.host, opts.port);
		clearTimeout(timeoutId);
		socket.destroy();
		cb(e);
	});

	timeoutId = setTimeout(function () {
		debug('tcp health check on %s:%s timedout', opts.host, opts.port);
		timedout = true;
		socket.destroy();
		cb(error('Connect timeout', 'CONNECTTIMEOUT'));
	}, opts.timeout || 500);

	socket.connect(opts.port, opts.host, function () {
		clearTimeout(timeoutId);
		socket.end();
		cb(null);
	});
};

/**
 * Health monitor
 * @param  {Array|String} urls a single url or array of urls to monitor.
 *                             Can be http:// or tcp://. For tcp the url must contain a port.
 * @param  {Object} [opts]
 * @param  {Object} [opts.interval] How often to poll url in ms. default 1000
 * @param  {Object} [opts.path] http path for http polls, overides the path in the url
 * @param  {Object} [opts.timeout] Connect timeout for poll in ms. default 500
 * @param {Function} cb callback for each poll cb(err) if not err present the service is healthy.
 * @return {Function}  function to stop monitoring.
 */
module.exports.monitor = function (urls, opts, cb) {
	opts = opts || {};
	if (typeof(opts) === 'function') {
		cb = opts;
		opts = {};
	}
	urls = typeof(urls) === 'object' ? urls : [urls];

	var interval = opts.interval || 1000,
		timeout = opts.timeout || 500,
		timeouts = {};

	urls.forEach(function (url) {
		var p = urlParse(url),
			checkHealth = p.protocol === 'tcp:' ? module.exports.tcp : module.exports.http,
			params = {
				url: url,
				host: p.hostname,
				port: p.port,
				path: opts.path || p.path || '/',
				timeout: timeout
			};

		var runAgain = function (err) {
			timeouts[url] = setTimeout(function () {
				checkHealth(params, runAgain);
			}, interval);
			cb.call(cb, err, url);
		};

		checkHealth(params, runAgain);
	});

	//stop function
	return function () {
		Object.keys(timeouts).forEach(function (url) {
			clearTimeout(timeouts[url]);
		});
		timeouts = {};
	};
};