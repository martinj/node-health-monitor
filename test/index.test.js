'use strict';
var health = require('../'),
	nock = require('nock'),
	http = require('http'),
	sinon = require('sinon'),
	assert = require('assert');

require('should');

describe('health', function () {
	describe('monitor()', function () {
		beforeEach(function () {
			nock('http://foo.com')
				.head('/ok')
				.reply(200)
				.head('/fail')
				.reply(500);
		});

		afterEach(function () {
			nock.cleanAll();
		});

		it('should return healthy on 200 response', function (done) {
			var stop = health.monitor(
				['http://foo.com'],
				{ path: '/ok' },
				function (err, url) {
					assert.equal(null, err);
					url.should.equal('http://foo.com');
					stop();
					done();
				}
			);
		});

		it('should return unhealthy on error', function (done) {
			var stop = health.monitor(
				['http://foo.com'],
				{ path: '/fail' },
				function (err, url) {
					err.code.should.equal('INVALIDSTATUSCODE');
					stop();
					done();
				}
			);
		});

		describe('tcp:// schema', function () {
			afterEach(function () {
				health.tcp.restore();
			});

			it('should use tcp for schema tcp://', function (done) {
				var stop;
				sinon.stub(health, 'tcp', function (opts) {
					opts.host.should.equal('localhost');
					opts.port.should.equal('8949');
					assert(health.tcp.called);
					done();
				});
				stop = health.monitor(['tcp://localhost:8949'], function () {});
			});
		});
	});

	describe('HTTP Timeout', function () {
		var server = http.createServer(function (req, res) {
			setTimeout(function () {
				res.writeHead(200, {'content-type': 'text/plain'});
				res.end();
			}, 300);
		});

		beforeEach(function (done) {
			server.on('listening', function () {
				done();
			}).listen(9898);
		});

		afterEach(function (done) {
			server.close(function () {
				done();
			});
		});

		it('should return unhealthy on timeout', function (done) {
			health.http(
				{ host: '127.0.0.1', port: 9898, path: '/', timeout: 1 },
				function (err) {
					err.code.should.equal('CONNECTTIMEOUT');
					done();
				}
			);
		});
	});
});