# docker-machine DNS server

This package fires up a tiny (~100 lines) DNS server whose sole purpose
is to listen for *.docker DNS lookups and resolve the hostname using 
`docker-machine ip`.

## How it works:

  * DNS query for dev.docker comes in
  * Server parses out "dev.docker"
  * Server responds with the result of `$(docker-machine ip dev)`

**Environment variables**

`DOCKER_MACHINE_DNS_RESOLVER`

Change the default IP resolver from `docker-machine ip` to your own custom command by setting this environment variable.

`DOCKER_MACHINE_DNS_TLD`

Change the default tld from `docker` by setting this environment variable.

## Setup:

Install in the usual way:

```
npm install -g docker-machine-dns
```

### Setup: The easy way

Run this: 

```bash
sudo mkdir -p /etc/resolver
sudo touch /etc/resolver/docker
sudo chown -R $USER /etc/resolver		
```

This creates the `/etc/resolver` directory (if it doesn't already exist)
and grants ownership to your current user account.  The service will
automatically configure the resolver/docker file on each run, making it
"just work".

### Setup: The way that doesn't require changing ownership of /etc/resolver

Write this to `/etc/resolver/docker` and always run with the same specified port

```
nameserver	127.0.0.1
port	12345
search_order	300000
timeout	1
```

**Note**: the whitespace separators in this file **NEED** to be tabs.  Spaces won't work.

## Example:

```
$ docker-machine ls
NAME   ACTIVE   DRIVER       STATE     URL                         SWARM
dev             virtualbox   Running   tcp://192.168.99.100:2376
dev2            virtualbox   Running   tcp://192.168.99.101:2376
dev3            virtualbox   Stopped

$ ping -t 4 dev.docker
ping: cannot resolve dev.docker: Unknown host

$ docker-machine-dns &
[1] 18007
Listening on UDP port 55451

$ ping -t 4 dev.docker
PING dev.docker (192.168.99.100): 56 data bytes
64 bytes from 192.168.99.100: icmp_seq=0 ttl=64 time=0.268 ms
64 bytes from 192.168.99.100: icmp_seq=1 ttl=64 time=0.272 ms
64 bytes from 192.168.99.100: icmp_seq=2 ttl=64 time=0.313 ms
64 bytes from 192.168.99.100: icmp_seq=3 ttl=64 time=0.454 ms

--- dev.docker ping statistics ---
4 packets transmitted, 4 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 0.268/0.327/0.454/0.076 ms

$ ping -t 4 dev2.docker
PING dev2.docker (192.168.99.101): 56 data bytes
64 bytes from 192.168.99.101: icmp_seq=0 ttl=64 time=0.232 ms
64 bytes from 192.168.99.101: icmp_seq=1 ttl=64 time=0.394 ms
64 bytes from 192.168.99.101: icmp_seq=2 ttl=64 time=0.284 ms
64 bytes from 192.168.99.101: icmp_seq=3 ttl=64 time=0.222 ms

--- dev2.docker ping statistics ---
4 packets transmitted, 4 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 0.222/0.283/0.394/0.068 ms
```

docker-machine-dns can take a UDP port as its first (and only) argument
to bind to that specific port instead of randomly picking one on each run.
