package datasource

import "testing"

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
