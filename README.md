# Convert GTFS Delay
Convert a GTFS(RT)-Dataset to postgres for delay analysis.

## File structure
The following file structure is required for this process to work properly.
```text
|-- docker-compose.yml
|-- data
|   |-- gtfs
|   |   |-- <ISO8601>
|   |   |   |-- toplevel.zip
|   |   |-- 2022-01-09T22:47:01+00:00
|   |   |   |-- toplevel.zip
|   |   |-- ...
|   |-- gtfsrt-zip
|   |   |-- <day>.tar.bz2
|   |   |-- 2022-01-02.tar.bz2
|   |   |-- 2022-01-03.tar.bz2
|   |   |-- ...
```

## Steps
You can select from the following steps, they should be run in this order though:
1. Import multiple GTFS files
2. Import multiple GTFSRT files
3. Reduce GTFSRT based on trip

## Usage
The easiest way to use this converter is by using the following `docker-compose.yml` file.

```yml
version: "3"
volumes:
  postgres:
    driver: local

services:
  convert:
    image: ghcr.io/passidel/convert-delay:${DELAY_VERSION}
    depends_on:
      - pgbouncer
    volumes:
      - ./data:/usr/local/bin/delay/data
    env_file:
      - .env
  postgres:
    image: postgres
    environment:
      POSTGRES_USER: ${DATABASE_USER:-postgres}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD:-changeme}
      POSTGRES_DB: ${DATABASE_DATABASE:-db}
      PGDATA: /data/postgres
    volumes:
      - ./data/postgres:/data/postgres
    ports:
      - "127.0.0.1:${DATABASE_PORT}:5432"
    restart: unless-stopped
  pgbouncer:
    image: bitnami/pgbouncer
    environment:
      POSTGRESQL_HOST: "postgres"
      POSTGRESQL_DATABASE: ${DATABASE_DATABASE:-db}
      PGBOUNCER_DATABASE: ${DATABASE_DATABASE:-db}
      POSTGRESQL_USERNAME: ${DATABASE_USER:-postgres}
      POSTGRESQL_PASSWORD: ${DATABASE_PASSWORD:-changeme}
      PGBOUNCER_PORT: ${BOUNCER_PORT}
      PGBOUNCER_POOL_MODE: "transaction"
    ports:
      - "127.0.0.1:${BOUNCER_PORT:-6432}:6432"
    links:
      - postgres:postgres
```

To control which steps should be executed, you can set environmental variables.

> Be aware that running a step again may truncate the whole database!
```dotenv
DATABASE_PASSWORD="gtfs"
DATABASE_DATABASE="gtfs"
DATABASE_USER="gtfs"
DATABASE_PORT="5432"
BOUNCER_PORT="6432"
DATABASE_URL="postgresql://gtfs:gtfs@pgbouncer:6432/gtfs?pgbouncer=true&pool_timeout=0"
PROD_DATABASE_URL="postgresql://gtfs:gtfs@postgres:5432/gtfs"

DELAY_VERSION="latest"

AGENCY="Bremer Straßenbahn AG"
STEP1="true"
STEP2="false"
STEP3="false"
```

```shell
docker-compose pull
docker-compose up -d convert
```

## Visualization
Since the webserver/visualization uses the same database as the converter, you can reuse their infrastructure by adding a new service to your `docker-compose.yml`.
```diff
services:
+  delay:
+    image: ghcr.io/passidel/bsag-delay:${DELAY_VERSION}
+    ports:
+      - "127.0.0.1:3000:3000"
+    depends_on:
+      - pgbouncer
+    volumes:
+      - ./.cache:/usr/local/bin/delay/.cache
+    env_file:
+      - .env
```