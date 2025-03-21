package grafanaclient

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type GrafanaHTTPClient interface {
	DoRequest(method string, url string, body io.Reader) (*http.Response, error)
	Get(url string) (*http.Response, error)
}

type grafanaHTTPClient struct {
	appURL     string
	httpClient *http.Client
}

func NewGrafanaHTTPClient(ctx context.Context, settings backend.DataSourceInstanceSettings, saToken string) (*grafanaHTTPClient, error) {
	grafanaAppURL := strings.TrimRight(os.Getenv("GF_APP_URL"), "/")
	if grafanaAppURL == "" {
		grafanaAppURL = "http://localhost:3000"
		log.DefaultLogger.Debug("URL is empty, set default one", "url", grafanaAppURL)
	}
	log.DefaultLogger.Debug("Grafana App URL", "url", grafanaAppURL)

	opts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting http client options: %w", err)
	}

	opts.Header = http.Header{
		"Authorization": []string{"Bearer " + saToken},
		"Content-Type":  []string{"application/json"},
	}

	httpClient, err := httpclient.New(opts)
	if err != nil {
		return nil, fmt.Errorf("error creating new http client: %w", err)
	}

	client := &grafanaHTTPClient{
		appURL:     grafanaAppURL,
		httpClient: httpClient,
	}

	return client, nil
}

func (c grafanaHTTPClient) DoRequest(method string, url string, body io.Reader) (*http.Response, error) {
	url = strings.TrimLeft(url, "/")
	appURL := strings.TrimRight(c.appURL, "/")
	req, err := http.NewRequest(method, fmt.Sprintf("%s/%s", appURL, url), body)
	if err != nil {
		return nil, err
	}
	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (c grafanaHTTPClient) Get(url string) (*http.Response, error) {
	return c.DoRequest("GET", url, nil)
}
