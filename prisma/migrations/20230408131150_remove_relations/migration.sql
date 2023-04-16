-- DropForeignKey
ALTER TABLE "Route" DROP CONSTRAINT "Route_agency_id_date_fkey";

-- DropForeignKey
ALTER TABLE "StopDelay" DROP CONSTRAINT "StopDelay_route_id_date_fkey";

-- DropForeignKey
ALTER TABLE "StopTime" DROP CONSTRAINT "StopTime_stop_id_date_fkey";

-- DropForeignKey
ALTER TABLE "StopTime" DROP CONSTRAINT "StopTime_trip_id_date_fkey";

-- DropForeignKey
ALTER TABLE "StripDelay" DROP CONSTRAINT "StripDelay_stop1_id_date_fkey";

-- DropForeignKey
ALTER TABLE "StripDelay" DROP CONSTRAINT "StripDelay_stop2_id_date_fkey";

-- DropForeignKey
ALTER TABLE "StripDelay" DROP CONSTRAINT "StripDelay_trip_id_date_fkey";

-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_route_id_date_fkey";
