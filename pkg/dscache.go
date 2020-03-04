package main

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"time"

	"github.com/grafana/grafana-plugin-model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	cache "github.com/patrickmn/go-cache"
)

var cacheLogger = hclog.New(&hclog.LoggerOptions{
	Name:  "strava-ds-cache",
	Level: hclog.LevelFromString("DEBUG"),
})

// DSCache is a abstraction over go-cache.
type DSCache struct {
	dsInfo  *datasource.DatasourceInfo
	gocache *cache.Cache
	dataDir string
}

// NewDSCache creates a go-cache with expiration(ttl) time and cleanupInterval.
func NewDSCache(dsInfo *datasource.DatasourceInfo, ttl time.Duration, cleanupInterval time.Duration, dataDir string) *DSCache {
	return &DSCache{
		dsInfo,
		cache.New(ttl, cleanupInterval),
		dataDir,
	}
}

// Add an item to the cache, replacing any existing item.
func (c *DSCache) Set(request string, response interface{}, d time.Duration) {
	c.gocache.Set(request, response, d)
}

// Set the value of the key "request" to "rersponse" with default expiration time.
func (c *DSCache) SetDefault(request string, response interface{}) {
	c.gocache.SetDefault(request, response)
}

// Get the value associated with request from the cache
func (c *DSCache) Get(request string) (interface{}, bool) {
	return c.gocache.Get(request)
}

func (c *DSCache) Save(request string, response interface{}) error {
	cacheKey := c.BuildDSCacheKey(request)
	filename := fmt.Sprintf("%s/%s", c.dataDir, cacheKey)
	return ioutil.WriteFile(filename, []byte(response.(string)), 0644)
}

func (c *DSCache) Load(request string) (string, error) {
	cacheKey := c.BuildDSCacheKey(request)
	filename := fmt.Sprintf("%s/%s", c.dataDir, cacheKey)
	cacheLogger.Debug("Loading key from file", "key", request, "path", filename)
	value, err := ioutil.ReadFile(filename)
	if err != nil {
		return "", err
	}
	response := string(value)
	c.Set(request, response, cache.NoExpiration)
	return response, nil
}

func (c *DSCache) BuildDSCacheKey(request string) string {
	return fmt.Sprintf("%v-%s", c.dsInfo.GetId(), request)
}

// HashString converts the given text string to hash string
func HashString(text string) string {
	hash := sha1.New()
	hash.Write([]byte(text))
	return hex.EncodeToString(hash.Sum(nil))
}

// HashDatasourceInfo converts the given datasource info to hash string
func HashDatasourceInfo(dsInfo *datasource.DatasourceInfo) string {
	digester := sha1.New()
	dsInfoUniq := map[string]interface{}{
		"Id":    dsInfo.GetId(),
		"OrgId": dsInfo.GetOrgId(),
	}
	if err := json.NewEncoder(digester).Encode(dsInfoUniq); err != nil {
		panic(err) // This shouldn't be possible but just in case DatasourceInfo changes
	}
	return hex.EncodeToString(digester.Sum(nil))
}
