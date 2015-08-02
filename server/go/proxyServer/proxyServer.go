package proxyServer

import (
	"bytes"
	"fmt"
	"github.com/golang/glog"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
)

type ProxyHttpServer struct {
}

var httpTransport = &http.Transport{}

var logger = log.New(os.Stderr, "", log.LstdFlags)

func copyHeaders(dst, src http.Header) {
	for item, _ := range dst {
		dst.Del(item)
	}

	for k, vs := range src {
		for _, v := range vs {
			dst.Add(k, v)
		}
	}
}

func wrongMsgResponse(msg string) *http.Response {
	resp := &http.Response{}
	resp.Header = make(http.Header)
	resp.StatusCode = http.StatusForbidden
	resp.Header.Add("Content-Type", "text/plain")

	buf := bytes.NewBufferString(msg)
	resp.ContentLength = int64(buf.Len())
	resp.Body = ioutil.NopCloser(buf)

	return resp
}

func CreateProxyServer() *ProxyHttpServer {
	return &ProxyHttpServer{}
}

func (*ProxyHttpServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	fetchUrl := r.Header.Get("fetchurl")
	originalHost := r.Header.Get("originalhost")
	var resp *http.Response

	if fetchUrl == "" {
		resp = wrongMsgResponse("This is a private page!")
	}

	convertedFetchUrl, err := url.Parse(fetchUrl)

	if err != nil {
		resp = wrongMsgResponse(fmt.Sprintf("Invalid fetchUrl, %s", err.Error()))
	}

	if resp == nil {
		r.URL = convertedFetchUrl
		r.RequestURI = ""
		r.RemoteAddr = ""
		r.Host = originalHost

		r.Header.Del("fetchurl")
		r.Header.Del("originalhost")
		r.Header.Del("proxy-connection")
		r.Header.Del("Content-Length")

		var err error
		resp, err = httpTransport.RoundTrip(r)

		if err != nil {
			resp = wrongMsgResponse(fmt.Sprintf("Can't close response body %v", err))
		}
	}

	glog.Infof("Copying response to client %v [%d]", resp.Status, resp.StatusCode)
	copyHeaders(w.Header(), resp.Header)
	w.WriteHeader(resp.StatusCode)
	nr, err := io.Copy(w, resp.Body)

	if err := resp.Body.Close(); err != nil {
		glog.Warningf("Can't close response body %v", err)
	}

	glog.Infof("Copied %v bytes to client error=%v", nr, err)
}
