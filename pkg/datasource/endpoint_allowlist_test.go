package datasource

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func TestAllowedEndpointPattern(t *testing.T) {
	allowed := []string{
		"athlete",
		"athlete/activities",
		"activities/12345",
		"activities/12345/streams",
		"segments/987",
	}
	for _, endpoint := range allowed {
		if !allowedEndpointPattern.MatchString(endpoint) {
			t.Errorf("expected endpoint %q to be allowed", endpoint)
		}
	}

	disallowed := []string{
		"athletes/12345",
		"clubs/1",
		"routes/1",
		"activities",
		"athlete/clubs",
		"athlete/activities/../../clubs",
		"segments/1/starred",
		"",
	}
	for _, endpoint := range disallowed {
		if allowedEndpointPattern.MatchString(endpoint) {
			t.Errorf("expected endpoint %q to be rejected", endpoint)
		}
	}
}

// TestStravaAPIQueryEndpointAllowlist proves the allowlist is enforced on the real call path
// (StravaAPIQuery), not just on the bare regexp, and that rejection happens before any HTTP
// request is issued to the Strava API.
func TestStravaAPIQueryEndpointAllowlist(t *testing.T) {
	newInstance := func(called *bool, status int, body string) *StravaDatasourceInstance {
		return &StravaDatasourceInstance{
			logger: log.New(),
			httpClient: &http.Client{
				Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
					*called = true
					return &http.Response{
						StatusCode: status,
						Body:       io.NopCloser(strings.NewReader(body)),
						Header:     make(http.Header),
					}, nil
				}),
			},
		}
	}

	t.Run("disallowed endpoint never issues an HTTP request", func(t *testing.T) {
		called := false
		ds := newInstance(&called, http.StatusOK, `{}`)

		_, err := ds.StravaAPIQuery(context.Background(), &StravaAPIRequest{
			Endpoint:    "athlete/clubs",
			AccessToken: "caller-token",
		})
		if err == nil {
			t.Fatal("expected an error for a disallowed endpoint")
		}
		if !errors.Is(err, ErrEndpointNotAllowed) {
			t.Errorf("expected ErrEndpointNotAllowed, got %v", err)
		}
		if called {
			t.Error("expected no HTTP request to be issued for a disallowed endpoint")
		}
	})

	t.Run("allowed endpoint issues the HTTP request", func(t *testing.T) {
		called := false
		ds := newInstance(&called, http.StatusOK, `{"id": 1}`)

		_, err := ds.StravaAPIQuery(context.Background(), &StravaAPIRequest{
			Endpoint:    "athlete",
			AccessToken: "caller-token",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !called {
			t.Error("expected the allowed endpoint to issue an HTTP request")
		}
	})
}
