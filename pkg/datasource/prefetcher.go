package datasource

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

const MaxTasks = 4

type StravaPrefetcher struct {
	depth      int
	cache      *DSCache
	ds         *StravaDatasourceInstance
	activities []string
}

func NewStravaPrefetcher(depth int, ds *StravaDatasourceInstance) *StravaPrefetcher {
	return &StravaPrefetcher{
		depth:      depth,
		cache:      ds.cache,
		ds:         ds,
		activities: []string{},
	}
}

// Run starts background prefetcher task
func (p *StravaPrefetcher) Run() {
	log.DefaultLogger.Info("Starting background prefetcher")

	activities, err := p.GetActivities()
	if err != nil {
		log.DefaultLogger.Error("Error fetching activities", "error", err)
		return
	}
	log.DefaultLogger.Debug("Activities", "value", activities)

	p.PrefetchActivitiesVariable(10)
	p.PrefetchActivitiesVariable(100)
	p.PrefetchActivities(activities)
}

func (p *StravaPrefetcher) GetActivities() ([]string, error) {
	query := &StravaAPIRequest{
		Endpoint: "athlete/activities",
		Params: map[string]json.RawMessage{
			"per_page": []byte(fmt.Sprintf("%d", p.depth)),
		},
	}
	resp, err := p.ds.StravaAPIQuery(context.Background(), query)
	if err != nil {
		return nil, fmt.Errorf("error fetching activities: %w", err)
	}
	activitiesRaw, ok := resp.Result.([]interface{})
	if !ok {
		return nil, fmt.Errorf("error parsing activities")
	}
	activities := make([]string, 0)
	for _, a := range activitiesRaw {
		activity, ok := a.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("error parsing activity")
		}
		activityIdRaw := activity["id"]
		activityId := activityIdRaw.(json.Number).String()
		activities = append(activities, activityId)
	}
	return activities, nil
}

func (p *StravaPrefetcher) PrefetchActivities(activities []string) {
	queue := make(chan int, MaxTasks)
	for i := 0; i < p.depth; i++ {
		activityId := activities[i]
		queue <- 1
		go func(activityId string) {
			p.PrefetchActivity(activityId)
			p.PrefetchActivityStreams(activityId)
			<-queue
		}(activityId)
	}
}

func (p *StravaPrefetcher) PrefetchActivity(activityId string) {
	payloadPattern := `{"datasourceId":%d,"endpoint":"/activities/%s","params":{"include_all_efforts":true}}`
	payload := fmt.Sprintf(payloadPattern, p.ds.dsInfo.ID, activityId)
	log.DefaultLogger.Debug("Prefetching", "payload", payload)

	requestHash := HashString(payload)
	stravaApiQueryFn := p.ds.StravaAPIQueryWithCache(requestHash)
	apiReq := &StravaAPIRequest{
		Endpoint: fmt.Sprintf("/activities/%s", activityId),
		Params: map[string]json.RawMessage{
			"include_all_efforts": []byte("true"),
		},
	}
	_, err := stravaApiQueryFn(context.Background(), apiReq)
	if err != nil {
		log.DefaultLogger.Error("Error loading activity", "errror", err)
	}
}

type PrefetchStreamTask struct {
	pattern string
	keys    map[string]json.RawMessage
}

func (p *StravaPrefetcher) PrefetchActivityStreams(activityId string) {
	prefetchTasks := []PrefetchStreamTask{
		{
			pattern: `{"datasourceId":%d,"endpoint":"/activities/%s/streams","params":{"key_by_type":true,"keys":"velocity_smooth,time"}}`,
			keys: map[string]json.RawMessage{
				"key_by_type": []byte("true"),
				"keys":        []byte("velocity_smooth,time"),
			},
		},
		{
			pattern: `{"datasourceId":%d,"endpoint":"/activities/%s/streams","params":{"key_by_type":true,"keys":"heartrate,time"}}`,
			keys: map[string]json.RawMessage{
				"key_by_type": []byte("true"),
				"keys":        []byte("heartrate,time"),
			},
		},
		{
			pattern: `{"datasourceId":%d,"endpoint":"/activities/%s/streams","params":{"key_by_type":true,"keys":"latlng,time"}}`,
			keys: map[string]json.RawMessage{
				"key_by_type": []byte("true"),
				"keys":        []byte("latlng,time"),
			},
		},
	}

	for _, task := range prefetchTasks {
		payload := fmt.Sprintf(task.pattern, p.ds.dsInfo.ID, activityId)
		log.DefaultLogger.Debug("Prefetching", "payload", payload)

		requestHash := HashString(payload)
		stravaApiQueryFn := p.ds.StravaAPIQueryWithCache(requestHash)
		apiReq := &StravaAPIRequest{
			Endpoint: fmt.Sprintf("/activities/%s/streams", activityId),
			Params:   task.keys,
		}
		_, err := stravaApiQueryFn(context.Background(), apiReq)
		if err != nil {
			log.DefaultLogger.Error("Error loading activity", "errror", err)
		}
	}
}

func (p *StravaPrefetcher) PrefetchActivitiesVariable(limit int) {
	payloadPattern := `{"datasourceId":%d,"endpoint":"athlete/activities","params":{"limit":%d,"per_page":%d,"page":1}}`
	payload := fmt.Sprintf(payloadPattern, p.ds.dsInfo.ID, limit, limit)
	log.DefaultLogger.Debug("Prefetching", "payload", payload)

	requestHash := HashString(payload)
	stravaApiQueryFn := p.ds.StravaAPIQueryWithCache(requestHash)
	apiReq := &StravaAPIRequest{
		Endpoint: "athlete/activities",
		Params: map[string]json.RawMessage{
			"limit":    []byte(fmt.Sprintf("%d", limit)),
			"per_page": []byte(fmt.Sprintf("%d", limit)),
			"page":     []byte("1"),
		},
	}
	_, err := stravaApiQueryFn(context.Background(), apiReq)
	if err != nil {
		log.DefaultLogger.Error("Error loading activities", "errror", err)
	}
}
