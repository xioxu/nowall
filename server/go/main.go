package main

import (
	"flag"
	"github.com/golang/glog"
	"net/http"
	"nowall_server_golang/proxyServer"
	"os"
)

const (
	PortVar = "VCAP_APP_PORT"
)

func main() {
	flag.Set("logtostderr", "true")
	proxyAddr := getProxtAddr()
	glog.Infof("Server is running on %s \n", proxyAddr)
	glog.Fatal(http.ListenAndServe(proxyAddr, proxyServer.CreateProxyServer()))
}

func getProxtAddr() string {
	var port string

	if port = os.Getenv(PortVar); port == "" {
		port = "9081"
	}

	return ":" + port
}
