#!/usr/bin/env python3
import json
import os
import argparse
import csv
import time
import requests

# Simple geocoding script that updates wildflowers_data.json using LocationIQ
# Reads/writes cache in CSV format: location,latitude,longitude,status

SEARCH_URL = 'https://us1.locationiq.com/v1/search'

def load_cache(cache_file):
    cache = {}
    if os.path.exists(cache_file):
        with open(cache_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                loc = row.get('location')
                lat = row.get('latitude')
                lon = row.get('longitude')
                status = row.get('status')
                if loc:
                    if status == 'success' and lat and lon:
                        cache[loc] = {'latitude': float(lat), 'longitude': float(lon)}
                    else:
                        cache[loc] = None
    return cache


def save_cache(cache, cache_file):
    rows = []
    for loc, val in cache.items():
        if val is None:
            rows.append({'location': loc, 'latitude': '', 'longitude': '', 'status': 'failed'})
        else:
            rows.append({'location': loc, 'latitude': val['latitude'], 'longitude': val['longitude'], 'status': 'success'})
    with open(cache_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['location', 'latitude', 'longitude', 'status'])
        writer.writeheader()
        writer.writerows(rows)


def geocode_location(api_key, location):
    params = {'key': api_key, 'q': location, 'format': 'json', 'accept-language': 'he,en', 'limit': 1}
    try:
        r = requests.get(SEARCH_URL, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list) and len(data) > 0:
            return {'latitude': float(data[0]['lat']), 'longitude': float(data[0]['lon'])}
        return None
    except Exception as e:
        print(f'API error for "{location}": {e}')
        return None


def main(api_key, input_file='wildflowers_data.json', cache_file='location_cache.csv'):
    # Backup
    bak_file = input_file + '.bak'
    if not os.path.exists(bak_file):
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            with open(bak_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f'Backup saved to {bak_file}')
        except Exception as e:
            print(f'Warning: could not create backup: {e}')

    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    unique_locations = set()
    for report in data:
        locs = report.get('locations') or []
        for loc in locs:
            name = loc.get('location_name') if isinstance(loc, dict) else loc
            if name and isinstance(name, str):
                unique_locations.add(name.strip())

    print(f'Found {len(unique_locations)} unique location strings')

    cache = load_cache(cache_file)

    to_query = sorted([loc for loc in unique_locations if loc not in cache])
    print(f'{len(to_query)} locations need geocoding (not present in cache)')

    successes = 0
    failures = 0
    for loc in to_query:
        res = geocode_location(api_key, loc)
        if res:
            cache[loc] = res
            successes += 1
        else:
            cache[loc] = None
            failures += 1
        # Respect rate limits
        time.sleep(1)

    print(f'Geocoding run complete: {successes} successes, {failures} failures')

    # Update reports
    updated_reports = 0
    for report in data:
        locs = report.get('locations') or []
        if 'geocoded_locations' not in report:
            report['geocoded_locations'] = {}
        if 'coordinates' not in report:
            report['coordinates'] = []

        changed = False
        for loc in locs:
            name = loc.get('location_name') if isinstance(loc, dict) else loc
            name = name.strip() if name else None
            if not name:
                continue
            cached = cache.get(name)
            if cached:
                report['geocoded_locations'][name] = {'latitude': float(cached['latitude']), 'longitude': float(cached['longitude'])}
                coords_entry = {'lat': float(cached['latitude']), 'lon': float(cached['longitude'])}
                if coords_entry not in report['coordinates']:
                    report['coordinates'].append(coords_entry)
                    changed = True
            else:
                if name not in report['geocoded_locations']:
                    report['geocoded_locations'][name] = None
                    changed = True
        if changed:
            updated_reports += 1

    with open(input_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    save_cache(cache, cache_file)

    print(f'Updated {updated_reports} reports in {input_file}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--api-key', required=True)
    parser.add_argument('--input-file', default='wildflowers_data.json')
    parser.add_argument('--cache-file', default='location_cache.csv')
    args = parser.parse_args()
    main(args.api_key, args.input_file, args.cache_file)
