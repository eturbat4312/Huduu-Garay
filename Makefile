LOCAL_COMPOSE := BACKEND_PORT=8011 docker compose -f docker-compose.yml -f compose.local.yml

.PHONY: local-up local-down web-rebuild web-logs local-status

local-up:
	$(LOCAL_COMPOSE) up -d --build --wait

local-down:
	$(LOCAL_COMPOSE) down

web-rebuild:
	$(LOCAL_COMPOSE) build frontend
	$(LOCAL_COMPOSE) up -d --no-deps --force-recreate --wait frontend

web-logs:
	$(LOCAL_COMPOSE) logs --tail 150 -f frontend

local-status:
	$(LOCAL_COMPOSE) ps
