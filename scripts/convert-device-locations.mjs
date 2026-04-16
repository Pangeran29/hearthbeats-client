import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_INPUT = "src/data/device_locations_202604121712.json";
const DEFAULT_OUTPUT = "src/data/gps-history.json";
const TARGET_OFFSET_MINUTES = 7 * 60;

function pad(number, width = 2) {
  return String(number).padStart(width, "0");
}

function formatWithOffset(isoUtc, offsetMinutes = TARGET_OFFSET_MINUTES) {
  const input = new Date(isoUtc);

  if (Number.isNaN(input.getTime())) {
    throw new Error(`Invalid timestamp: ${isoUtc}`);
  }

  const shifted = new Date(input.getTime() + offsetMinutes * 60_000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffset / 60);
  const offsetMins = absoluteOffset % 60;

  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}.` +
    `${pad(shifted.getUTCMilliseconds(), 3)}${sign}${pad(offsetHours)}:${pad(offsetMins)}`
  );
}

function normalizeLocation(location) {
  return {
    id: location.id,
    imei: location.imei,
    serverReceivedAt: formatWithOffset(location.server_received_at),
    gpsTimestamp: formatWithOffset(location.gps_timestamp),
    latitude: location.latitude,
    longitude: location.longitude,
    speedKph: location.speed_kph,
    course: location.course,
    satelliteCount: location.satellite_count,
    packetFamily: location.packet_family,
    peerAddr: location.peer_addr,
  };
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  const inputPath = path.resolve(process.cwd(), inputArg ?? DEFAULT_INPUT);
  const outputPath = path.resolve(process.cwd(), outputArg ?? DEFAULT_OUTPUT);

  const raw = await readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || !Array.isArray(parsed.device_locations)) {
    throw new Error("Expected JSON object with a device_locations array.");
  }

  const normalized = parsed.device_locations.map(normalizeLocation);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  console.log(`Converted ${normalized.length} rows`);
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
