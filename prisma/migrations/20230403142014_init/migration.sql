-- CreateTable
CREATE TABLE "Strip" (
    "id" TEXT NOT NULL,
    "stop1" TEXT NOT NULL,
    "stop2" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "StripDelay" (
    "date" TIMESTAMP NOT NULL,
    "id" SERIAL NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "stop1_id" TEXT NOT NULL,
    "stop2_id" TEXT NOT NULL,
    "delay" INTEGER NOT NULL,
    "timestamp" TIMESTAMP NOT NULL,

    CONSTRAINT "StripDelay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StopDelay" (
    "date" TIMESTAMP NOT NULL,
    "id" SERIAL NOT NULL,
    "route_id" INTEGER NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "stop_id" TEXT,
    "start_time" TIME NOT NULL,
    "start_date" DATE NOT NULL,
    "arrival_delay" INTEGER,
    "departure_delay" INTEGER,
    "stopSequence" INTEGER NOT NULL,
    "timestamp" TIMESTAMP NOT NULL,

    CONSTRAINT "StopDelay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agency" (
    "date" TIMESTAMP NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "agency_name" TEXT NOT NULL DEFAULT '',
    "agency_url" TEXT NOT NULL DEFAULT '',
    "agency_timezone" TEXT NOT NULL DEFAULT '',
    "agency_lang" CHAR(2) NOT NULL DEFAULT 'de',
    "agency_phone" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "Route" (
    "date" TIMESTAMP NOT NULL,
    "route_id" INTEGER NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "route_short_name" TEXT NOT NULL DEFAULT '',
    "route_long_name" TEXT NOT NULL DEFAULT '',
    "route_type" SMALLINT NOT NULL DEFAULT 0,
    "route_color" VARCHAR(6) NOT NULL DEFAULT '',
    "route_text_color" VARCHAR(6) NOT NULL DEFAULT '',
    "route_desc" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "Trip" (
    "date" TIMESTAMP NOT NULL,
    "route_id" INTEGER NOT NULL,
    "service_id" SMALLINT NOT NULL DEFAULT 0,
    "trip_id" INTEGER NOT NULL,
    "trip_headsign" TEXT NOT NULL DEFAULT '',
    "trip_short_name" TEXT NOT NULL DEFAULT '',
    "direction_id" SMALLINT NOT NULL DEFAULT 0,
    "block_id" SMALLINT,
    "shape_id" INTEGER,
    "wheelchair_accessible" SMALLINT NOT NULL DEFAULT 0,
    "bikes_allowed" SMALLINT NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "StopTime" (
    "date" TIMESTAMP NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "arrival_time" TIME NOT NULL,
    "departure_time" TIME NOT NULL,
    "stop_id" TEXT NOT NULL,
    "stop_sequence" INTEGER NOT NULL,
    "pickup_type" SMALLINT NOT NULL DEFAULT 0,
    "drop_off_type" SMALLINT NOT NULL DEFAULT 0,
    "stop_headsign" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "Stop" (
    "date" TIMESTAMP NOT NULL,
    "stop_id" TEXT NOT NULL,
    "stop_code" TEXT DEFAULT '',
    "stop_name" TEXT DEFAULT '',
    "stop_desc" TEXT DEFAULT '',
    "stop_lat" TEXT DEFAULT '',
    "stop_lon" TEXT DEFAULT '',
    "location_type" SMALLINT NOT NULL DEFAULT 0,
    "parent_station" TEXT DEFAULT '',
    "wheelchair_boarding" SMALLINT NOT NULL DEFAULT 0,
    "platform_code" TEXT DEFAULT '',
    "zone_id" TEXT DEFAULT ''
);

-- CreateIndex
CREATE UNIQUE INDEX "Strip_id_key" ON "Strip"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Strip_stop1_stop2_key" ON "Strip"("stop1", "stop2");

-- CreateIndex
CREATE INDEX "StripDelay_stop1_id_stop2_id_idx" ON "StripDelay"("stop1_id", "stop2_id");

-- CreateIndex
CREATE INDEX "StripDelay_stop1_id_idx" ON "StripDelay"("stop1_id");

-- CreateIndex
CREATE INDEX "StripDelay_stop2_id_idx" ON "StripDelay"("stop2_id");

-- CreateIndex
CREATE INDEX "StripDelay_timestamp_idx" ON "StripDelay"("timestamp");

-- CreateIndex
CREATE INDEX "StopDelay_trip_id_start_date_idx" ON "StopDelay"("trip_id", "start_date");

-- CreateIndex
CREATE INDEX "Agency_date_idx" ON "Agency"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_date_agency_id_key" ON "Agency"("date", "agency_id");

-- CreateIndex
CREATE INDEX "Route_agency_id_idx" ON "Route"("agency_id");

-- CreateIndex
CREATE INDEX "Route_route_short_name_idx" ON "Route"("route_short_name");

-- CreateIndex
CREATE INDEX "Route_date_idx" ON "Route"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Route_date_route_id_key" ON "Route"("date", "route_id");

-- CreateIndex
CREATE INDEX "Trip_route_id_idx" ON "Trip"("route_id");

-- CreateIndex
CREATE INDEX "Trip_date_idx" ON "Trip"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_date_trip_id_key" ON "Trip"("date", "trip_id");

-- CreateIndex
CREATE INDEX "StopTime_trip_id_idx" ON "StopTime"("trip_id");

-- CreateIndex
CREATE INDEX "StopTime_date_idx" ON "StopTime"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StopTime_date_trip_id_stop_sequence_key" ON "StopTime"("date", "trip_id", "stop_sequence");

-- CreateIndex
CREATE INDEX "Stop_date_idx" ON "Stop"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Stop_date_stop_id_key" ON "Stop"("date", "stop_id");

-- AddForeignKey
ALTER TABLE "StripDelay" ADD CONSTRAINT "StripDelay_trip_id_date_fkey" FOREIGN KEY ("trip_id", "date") REFERENCES "Trip"("trip_id", "date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripDelay" ADD CONSTRAINT "StripDelay_stop1_id_date_fkey" FOREIGN KEY ("stop1_id", "date") REFERENCES "Stop"("stop_id", "date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripDelay" ADD CONSTRAINT "StripDelay_stop2_id_date_fkey" FOREIGN KEY ("stop2_id", "date") REFERENCES "Stop"("stop_id", "date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopDelay" ADD CONSTRAINT "StopDelay_route_id_date_fkey" FOREIGN KEY ("route_id", "date") REFERENCES "Route"("route_id", "date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_agency_id_date_fkey" FOREIGN KEY ("agency_id", "date") REFERENCES "Agency"("agency_id", "date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_route_id_date_fkey" FOREIGN KEY ("route_id", "date") REFERENCES "Route"("route_id", "date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopTime" ADD CONSTRAINT "StopTime_trip_id_date_fkey" FOREIGN KEY ("trip_id", "date") REFERENCES "Trip"("trip_id", "date") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopTime" ADD CONSTRAINT "StopTime_stop_id_date_fkey" FOREIGN KEY ("stop_id", "date") REFERENCES "Stop"("stop_id", "date") ON DELETE RESTRICT ON UPDATE CASCADE;
