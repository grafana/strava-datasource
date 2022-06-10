package datasource

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	hclog "github.com/hashicorp/go-hclog"
	cache "github.com/patrickmn/go-cache"
)

var cacheLogger = hclog.New(&hclog.LoggerOptions{
	Name:  "strava-ds-cache",
	Level: hclog.LevelFromString("DEBUG"),
})

// DSCache is a abstraction over go-cache.
type DSCache struct {
	dsInfo  *backend.DataSourceInstanceSettings
	gocache *cache.Cache
	dataDir string
}

// NewDSCache creates a go-cache with expiration(ttl) time and cleanupInterval.
func NewDSCache(dsInfo *backend.DataSourceInstanceSettings, ttl time.Duration, cleanupInterval time.Duration, dataDir string) *DSCache {
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

// Removed item from cache
func (c *DSCache) Delete(request string) {
	c.gocache.Delete(request)
}

func (c *DSCache) Save(request string, response interface{}) error {
	cacheKey := c.BuildDSCacheKey(request)
	filename := filepath.Join(c.dataDir, cacheKey)
	cacheLogger.Debug("Saving key to file", "key", request, "path", filename)
	return os.WriteFile(filename, []byte(response.(string)), 0644)
}

func (c *DSCache) Load(request string) (string, error) {
	cacheKey := c.BuildDSCacheKey(request)
	filename := filepath.Join(c.dataDir, cacheKey)
	cacheLogger.Debug("Loading key from file", "key", request, "path", filename)
	value, err := os.ReadFile(filename)
	if err != nil {
		return "", err
	}
	response := string(value)
	c.Set(request, response, cache.NoExpiration)
	return response, nil
}

func (c *DSCache) BuildDSCacheKey(request string) string {
	return fmt.Sprintf("%v-%s", c.dsInfo.ID, request)
}

// HashString converts the given text string to hash string
func HashString(text string) string {
	hash := sha1.New()
	hash.Write([]byte(text))
	return hex.EncodeToString(hash.Sum(nil))
}

// HashDatasourceInfo converts the given datasource info to hash string
func HashDatasourceInfo(dsInfo *backend.DataSourceInstanceSettings) string {
	digester := sha1.New()
	dsInfoUniq := map[string]interface{}{
		"Id": dsInfo.ID,
		// "OrgId": dsInfo.,
	}
	if err := json.NewEncoder(digester).Encode(dsInfoUniq); err != nil {
		panic(err) // This shouldn't be possible but just in case DatasourceInfo changes
	}
	return hex.EncodeToString(digester.Sum(nil))
}
