/*
	This module contains a very simple cache for auth info (like refresh token) which is persisted
	for plugin process lifetime. This is required because when plugin settings are updated, new plugin instance is
	created and previously cached data is not available anymore.
*/
package datasource

import "sync"

type AuthCache struct {
	cache map[int64]*DSAuthCache
	m     sync.Mutex
}

type DSAuthCache struct {
	refreshToken string
	m            sync.Mutex
}

var authCache AuthCache = AuthCache{cache: make(map[int64]*DSAuthCache), m: sync.Mutex{}}

func GetAuthCache() *AuthCache {
	return &authCache
}

func GetDSAuthCache(dsId int64) *DSAuthCache {
	ac := GetAuthCache()
	if c := ac.getDSAuthCache(dsId); c != nil {
		return c
	} else {
		return ac.initDSAuthCache(dsId)
	}
}

func (c *AuthCache) initDSAuthCache(dsId int64) *DSAuthCache {
	dsCache := &DSAuthCache{m: sync.Mutex{}}
	c.m.Lock()
	defer c.m.Unlock()
	c.cache[dsId] = dsCache
	return dsCache
}

func (c *AuthCache) getDSAuthCache(dsId int64) *DSAuthCache {
	c.m.Lock()
	dsCache, ok := c.cache[dsId]
	c.m.Unlock()
	if ok {
		return dsCache
	}
	return nil
}

func (d *DSAuthCache) GetRefreshToken() string {
	d.m.Lock()
	defer d.m.Unlock()
	return d.refreshToken
}

func (d *DSAuthCache) SetRefreshToken(t string) {
	d.m.Lock()
	d.refreshToken = t
	d.m.Unlock()
}
