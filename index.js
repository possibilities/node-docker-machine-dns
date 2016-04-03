#!/usr/bin/env node

'use strict';

var exec = require('child_process').exec;
var fs = require('fs');
var udp = require('dgram');
var cache = {};

var s = udp.createSocket('udp4');
s.bind(process.argv[2] || 0, function() {
    var port = s.address().port;
    console.log('Listening on UDP port', port);
    if (process.env.DOCKER_MACHINE_DNS_TLD) {
        console.log('TLD:', process.env.DOCKER_MACHINE_DNS_TLD);
    }
    updateConfiguration(port);
    s.on('message', handleDgram);
});

function handleDgram(chunk, rinfo) {
    var length, offset, targetIndex;
    var txnid = chunk.slice(0, 2);
    var hostname = {
        machineName: '',
        fqdn: [],
        octets: null
    };
    var machineName = hostname.fqdn[hostname.fqdn.length - 2];

    // read the domain name
    for (offset = 12; chunk[offset]; offset += length) {
        length = chunk[offset];
        targetIndex = offset + length + 1;
        hostname.fqdn.push(chunk.slice(++offset, targetIndex).toString());
    }

    hostname.machineName = machineName;
    hostname.fqdn = hostname.fqdn.join('.');
    hostname.octets = chunk.slice(12, offset);

    return lookupDomain(txnid, hostname).then(function(dgramData) {
        s.send(new Buffer(dgramData), 0, dgramData.length, rinfo.port, rinfo.address);
    });
}

function updateConfiguration(port) {
    var tld = 'docker';
    if (process.env.DOCKER_MACHINE_DNS_TLD) {
        tld = process.env.DOCKER_MACHINE_DNS_TLD;
    }
    var resolverPath = '/etc/resolver/' + tld;

    var fileConfig = 'nameserver\t127.0.0.1\n' +
                     'port\t' + port + '\n' +
                     'search_order\t300000\n' +
                     'timeout\t1\n';

    try {
        fs.unlinkSync(resolverPath);
    } catch (e) { }

    try {
        fs.writeFileSync(resolverPath, fileConfig);
    }
    catch (e) {
        console.warn('Could not automatically configure resolver; make sure ' + resolverPath + ' is properly set up');
    }
}

function getMachineIp(machineName) {
    return new Promise(function(resolve, reject) {
        var cmd = 'docker-machine ip';
        if (process.env.DOCKER_MACHINE_DNS_RESOLVER) {
            cmd = process.env.DOCKER_MACHINE_DNS_RESOLVER;
        }

        exec(cmd + ' ' + machineName, function(err, stdout) {
            if (err && cache[machineName]) {
                resolve(cache[machineName]);
            } else if (err) {
                console.error(err.message);
                reject(err);
                return;
            }

            cache[machineName] = stdout.trim();
            resolve(cache[machineName]);
        });
    });
}

function lookupDomain(txnid, hostname) {
    return getMachineIp(hostname.machineName).then(function(ipStr) {
        var ipOctets = ipStr.split('.').map(Number);

        var bufarr = [
            txnid[0], txnid[1], // txnid
            0x81, 0x00,         // flags (std response)
            0x00, 0x00,         // question count
            0x00, 0x01,         // answer count
            0x00, 0x00,         // authority count
            0x00, 0x00          // additional
        ];

        for (var x = 0; x < hostname.octets.length; x++) {
            bufarr.push(hostname.octets[x]);
        }
        bufarr.push(0x00);

        bufarr = bufarr.concat([
            0x00, 0x01,             // Type A (host address)
            0x00, 0x01,             // Class: IN
            0x00, 0x00, 0x00, 0x00, // TTL
            0x00, 0x04,             // ip length
        ]);

        bufarr = bufarr.concat(ipOctets);

        return new Buffer(bufarr);
    });
}
