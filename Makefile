all: install build test lint

# Install dependencies
install: install-frontend install-backend

install-frontend:
	yarn install --pure-lockfile

install-backend:
	go mod vendor
	GO111MODULE=off go get -u golang.org/x/lint/golint

build: build-frontend build-backend
build-frontend:
	yarn dev

build-backend:
	env GOOS=linux go build -mod=vendor -o ./dist/strava-plugin_linux_amd64 ./pkg

build-debug:
	env GOOS=linux go build -mod=vendor -gcflags=all="-N -l" -o ./dist/strava-plugin_linux_amd64 ./pkg
run-backend:
	# Rebuilds plugin on changes and kill running instance which forces grafana to restart plugin
	# See .bra.toml for bra configuration details
	bra run

dist: dist-frontend dist-backend
dist-frontend:
	yarn build
dist-backend: dist-backend-linux dist-backend-darwin dist-backend-windows
dist-backend-windows: extension = .exe
dist-backend-%:
	$(eval filename = strava-plugin_$*_amd64$(extension))
	env GOOS=$* GO111MODULE=on GOARCH=amd64 go build -ldflags="-s -w" -mod=vendor -o ./dist/$(filename) ./pkg

run-frontend:
	yarn start

.PHONY: test
test: test-frontend test-backend
test-frontend:
	yarn test
test-backend:
	go test -v -mod=vendor ./pkg/...
test-ci:
	yarn ci-test
	mkdir -p tmp/coverage/golang/
	go test -race -coverprofile=tmp/coverage/golang/coverage.txt -covermode=atomic -mod=vendor ./pkg/...

.PHONY: clean
clean:
	-rm -r ./dist/

.PHONY: lint
lint: lint-backend

lint-backend:
	golint -min_confidence=1.1 -set_exit_status pkg/...
