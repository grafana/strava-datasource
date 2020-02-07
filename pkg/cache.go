package main

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"io/ioutil"
	"time"

	"github.com/grafana/grafana-plugin-model/go/datasource"
	cache "github.com/patrickmn/go-cache"
)

// Cache is a abstraction over go-cache.
type Cache struct {
	gocache *cache.Cache
	dataDir string
}

// NewCache creates a go-cache with expiration(ttl) time and cleanupInterval.
func NewCache(ttl time.Duration, cleanupInterval time.Duration, dataDir string) *Cache {
	return &Cache{
		cache.New(ttl, cleanupInterval),
		dataDir,
	}
}

// Add an item to the cache, replacing any existing item.
func (c *Cache) Set(request string, response interface{}, d time.Duration) {
	c.gocache.Set(request, response, d)
}

// Set the value of the key "request" to "rersponse" with default expiration time.
func (c *Cache) SetDefault(request string, response interface{}) {
	c.gocache.SetDefault(request, response)
}

func (c *Cache) SaveToFile(request string, response interface{}) {
	filename := c.dataDir + "/" + request
	ioutil.WriteFile(filename, []byte(response.(string)), 0644)
}

// Get the value associated with request from the cache
func (c *Cache) Get(request string) (interface{}, bool) {
	return c.gocache.Get(request)
}

func (c *Cache) GetFromFile(request string) (string, error) {
	filename := c.dataDir + "/" + request
	value, err := ioutil.ReadFile(filename)
	if err != nil {
		return "", err
	}
	return string(value), nil
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
	if err := json.NewEncoder(digester).Encode(dsInfo); err != nil {
		panic(err) // This shouldn't be possible but just in case DatasourceInfo changes
	}
	return hex.EncodeToString(digester.Sum(nil))
}
