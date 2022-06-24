package datasource

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

const MaxTasks = 2

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
			// p.ds.StravaAPIQueryWithCache()
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

			<-queue
		}(activityId)
	}
}
