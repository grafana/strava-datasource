package main

type TokenExchangeResponse struct {
	AccessToken      string `json:"access_token"`
	AccessTokenExpAt int64  `json:"expires_at"`
	RefreshToken     string `json:"refresh_token"`
}
