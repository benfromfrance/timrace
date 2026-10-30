.PHONY: all install dev build preview typecheck docker-build docker-up docker-down clean

all: build

install:
	npm install

dev: install
	npm run dev

build: install
	npm run build

preview: build
	npm run preview

typecheck:
	npm run typecheck

docker-build:
	docker build -t timcar:latest .

docker-up:
	docker compose up -d

docker-down:
	docker compose down

clean:
	rm -rf dist
