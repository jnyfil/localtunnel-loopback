# localtunnel-loopback
https://user-images.githubusercontent.com/75435724/222449558-d068b062-5461-4668-b8c9-781e612ed856.mp4

It is based on https://github.com/localtunnel/server and has been modified to allow connections to the loopback address (http://localhost)
If you want to use it as a subdomain, use https://github.com/localtunnel/server

## Overview

Due to policy reasons, web-based IDEs like Colab may have restrictions on using SSH tunneling. In this case, HTTP tunneling services like Gradio or Ngrok can be used.

These tunneling services have limitations, including restricted access and speed. They can also potentially cause unauthorized access to other servers through random subdomains connecting to remote servers. Also, every time the server is restarted, the address changes, making it difficult to resume previous work, and functionality may be restricted due to CORS. However, by using this, these issues can be resolved.

But, the following prerequisites are required to use this server:

* Node.js must be installed and available for use on your machine.
* Your machine must be accessible from an external machine (e.g., Colab), so you need to know about port forwarding.
* You should be able to configure the firewall settings.

If you don't understand how to configure firewall settings or set up port forwarding, it is not recommended to use this. Instead, a paid tunneling plan may be a better option.

## Use the server

First, install Node.js v18.x or later from https://nodejs.org  
If you are not familiar with the installation, search for how to install Node.js

Then, run below:

```shell
$ npx localtunnel-loopback # Without '--port', it run on port 80
tcp server listening on port: 34211

# If you want a secure connection:
$ npx localtunnel-loopback --use-https --tunnel-port 12345 # Without '--port', it run on port 443
tcp server listening on port: 12345

# If you want to run the server on a different port:
$ npx localtunnel-loopback --port 1234 --tunnel-port 12345
tcp server listening on port: 12345
```
The localtunnel server is now running and waiting for client requests on port 1234

**IMPORTANT** Make sure to configure both ports, '--port' (1234) and '--tunnel-port' (12345), in the firewall and port forwarding settings. If either of the ports is blocked, the server will not function properly."  
For more command options, refer to [Server Command options](#server-command-options)

> Port forwarding can vary depending on the manufacturer and model of the router, so please search for instructions on how to configure it

## Use the client

Since the client machine's configuration may differ from your local machine, the installation process can vary. For example, if you're using Colab, Node.js v14.x is already pre-installed, so you can run the client directly using the following command without any additional installation steps.

```shell
$ npx localtunnel --port 8080 --host "http://123.123.123.100:1234"

your url is: http://localhost:7860
```
> If your server is acting as a reverse proxy (i.e. nginx) and is able to listen on port 80, then you do not need the `:1234` part of the hostname for the `localtunnel` client.

You will be assigned a URL similar to `http://localhost:7860`

For detailed instructions on how to install and use the client, please refer to https://github.com/localtunnel/localtunnel.

## Multiple connections
A server can accept multiple client connections by default.  
However, it is important to note that all ports are automatically assigned except for '--tunnel-port' and '--local-port'.

```shell
# your machine
$ npx localtunnel-loopback --port 1234 --tunnel-port 33212 --local-port 5542 
server listening on port: 1234

# remote machine
$ npx localtunnel --port 80 --host "http://123.123.123.100:1234"
your url is: http://localhost:5542

server is running at http://localhost:5542 # message on server 
tcp server listening on port: 33212 # message on server 

# a new client on remote machine
$ npx localtunnel --port 8080 --host "http://123.123.123.100:1234"
your url is: http://localhost:33214

server is running at http://localhost:33214 # message on server 
tcp server listening on port: 33213 # message on server 
```

Connecting two or more clients can be difficult to set up with firewalls and port forwarding due to the random assignment of ports.  

Inputting multiple ports separated by spaces after '--tunnel-port' as follows will bind the ports in the order in which they are entered.

```shell
npx localtunnel-loopback --port 1234 --tunnel-port 33212 42421 1223
```

Then, all of the following ports need to be opened: 1234, 33212, 42421, and 1223.


## Server Command options

| Option             | Description                                                                                                                                                                     | Default Value                            |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------|
| `--use-https`      | Use this flag to indicate proxy over HTTPS.                                                                                                                                     | `false`                                  |
| `--https-key-path` | Path to private key file. Only used when `--use-https` flag is specified.                                                                                               | `~/.ssh/private.key.pem`                 |
| `--https-cert-path`| Path to certificate file. Only used when `--use-https` flag is specified.                                                                                               | `~/.ssh/certificate.crt.pem`             |
| `--https-ca-path`| Path to certificate authority file. Only used when `--use-https` flag is specified                                                                                               | `~/.ssh/ca.pem`             |
| `--address`        | IP address to bind to.                                                                                                                                                          | `0.0.0.0`                                |
| `--port`           | Listen on this port for outside requests. If this option is not used, the server automatically listens on port 80 or 443 depending on `--use-https` flag, which is the default behavior. | `80` or `443` depending on `--use-https` |
| `--tunnel-port`    | Establish on this port.                                                                                                                                                         |                                          |
| `--local-port`     | Access to the established destination by this port                                                                                                                                  | `7860`                                   |
| `--max-sockets`    | Maximum number of TCP sockets each client is allowed to establish at one time (the tunnels).                                                                                    | `10`                                     |

## Deploy

You can deploy your own localtunnel server using the prebuilt docker image.

**Note** This assumes that you have a proxy in front of the server to handle the http(s) requests and forward them to the localtunnel server on port 3000. You can use our [localtunnel-nginx](https://github.com/localtunnel/nginx) to accomplish this.

If you do not want ssl support for your own tunnel (not recommended), then you can just run the below with `--port 80` instead.

```
docker run -d \
    --restart always \
    --name localtunnel \
    --net host \
    defunctzombie/localtunnel-server:latest --port 3000
```
