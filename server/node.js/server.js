#!/bin/env node

var request = require("request");
var express = require("express");
var fs = require("fs");
var spdy = require('spdy');
var config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
var directServer = require("./directProxyServer");

var spdyOptions = {
    key: fs.readFileSync(__dirname + '/nowall.crt'),
    cert: fs.readFileSync(__dirname + '/nowall.crt'),
    ca: fs.readFileSync(__dirname + '/ca.crt'),

    // **optional** SPDY-specific options
    windowSize: 1024 * 1024, // Server's window size

    // **optional** if true - server will send 3.1 frames on 3.0 *plain* spdy
    autoSpdy31: false
};

var nowallServerApp = function() {

    //  Scope.
    var self = this;


    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.httpPort      = process.env.OPENSHIFT_NODEJS_PORT || config.proxyServerHttpPort;
        self.httpsPort = config.proxyServerHttpsPort || 443;
        self.directPort = config.directProxyServerHttpPort;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 0.0.0.0');
            self.ipaddress = "0.0.0.0";
        };
    };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {

        var proxyFunc = function(req,res){

            if(!req.headers.fetchurl) {
                return res.end('must have fetchUrl!');
            }

            req.headers.host = req.headers.originalhost;
            var request_url=req.headers.fetchurl;

            delete req.headers["fetchurl"];
            delete req.headers["proxy-connection"];
            delete req.headers["originalhost"];

            var proxyReq = request(request_url,{followRedirect:false});


            req.pipe(proxyReq);
            proxyReq.pipe(res);
        };

        self.httpSvr = express.createServer();

        self.app = express();
        self.httpsSvr = spdy.createServer(spdyOptions,self.app);

        self.httpSvr.use(proxyFunc);
        self.app.use(proxyFunc);
    };

    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };

    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.httpsSvr.listen(self.httpsPort, self.ipaddress, function() {
            console.log('%s: Node server(spdy) started on %s:%d ...',
                Date(Date.now() ), self.ipaddress, self.httpsPort);
        });

        self.httpSvr.listen(self.httpPort, self.ipaddress, function() {
            console.log('%s: Node server(http) started on %s:%d ...',
                Date(Date.now() ), self.ipaddress, self.httpPort);
        });

        directServer(self.directPort);
        console.log('%s: Node direct proxy server(http) started on %s:%d ...',
            Date(Date.now() ), self.ipaddress, self.directPort);
    };
};   /*  Sample Application.  */

/**
 *  main():  Main code.
 */
var nowallServer = new nowallServerApp();
nowallServer.initialize();
nowallServer.start();
