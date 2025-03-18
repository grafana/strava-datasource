arch-split = $(word $2,$(subst _, ,$1))

all: install build test

# Install dependencies
install: install-frontend install-backend

install-frontend:
	yarn install --pure-lockfile

install-backend:
	go get -u golang.org/x/lint/golint

build: build-frontend build-backend
build-frontend:
	yarn build

build-backend:
	env GOOS=linux go build -o ./dist/strava-plugin_linux_amd64 ./pkg

build-debug:
	env GOOS=linux go build -gcflags=all="-N -l" -o ./dist/strava-plugin_linux_amd64 ./pkg
run-backend:
	# Rebuilds plugin on changes and kill running instance which forces grafana to restart plugin
	# See .bra.toml for bra configuration details
	bra run

dist: dist-frontend dist-backend
dist-frontend:
	yarn build
dist-backend: dist-backend-linux_amd64 dist-backend-linux_arm dist-backend-linux_arm64 dist-backend-darwin_amd64 dist-backend-darwin_arm64 dist-backend-windows_amd64
dist-backend-windows_amd64: extension = .exe
dist-backend-linux_arm:
	env GOOS=linux GOARCH=arm GOARM=6 go build -ldflags="-s -w" -o ./dist/strava-plugin_linux_arm ./pkg
dist-backend-linux_arm64:
	env GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o ./dist/strava-plugin_linux_arm64 ./pkg
dist-backend-%:
	$(eval filename = strava-plugin_$*$(extension))
	env GOOS=$(call arch-split,$*,1) GO111MODULE=on GOARCH=$(call arch-split,$*,2) go build -ldflags="-s -w" -o ./dist/$(filename) ./pkg

run-frontend:
	yarn start

.PHONY: test
test: test-frontend test-backend
test-frontend:
	yarn test:ci
test-backend:
	go test -v ./pkg/...
test-ci:
	yarn ci-test
	mkdir -p tmp/coverage/golang/
	go test -race -coverprofile=tmp/coverage/golang/coverage.txt -covermode=atomic ./pkg/...

.PHONY: clean
clean:
	-rm -r ./dist/

.PHONY: lint
lint: lint-backend

lint-backend:
	golint -min_confidence=1.1 -set_exit_status pkg/...
