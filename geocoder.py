import json
import requests
from geopy.geocoders import Nominatim
import os
from dotenv import load_dotenv
load_dotenv()
import shelve
import time
from requests.exceptions import ReadTimeout
from tqdm import tqdm
import traceback

# Initialize Nominatim geocoder (OSM)
geolocator = Nominatim(user_agent="my_geocoder")

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# Cache setup
CACHE_FILE = "geocache.db"
cache = shelve.open(CACHE_FILE, writeback=True)

use_google_maps = bool(GOOGLE_MAPS_API_KEY)  # check if the google maps api key exists or not once

def get_coordinates_osm(location_name, max_retries=3, base_delay=1):
    for attempt in range(max_retries):
        try:
            location = geolocator.geocode(location_name, timeout=10)
            if location:
                return {"latitude": location.latitude, "longitude": location.longitude}
        except ReadTimeout:
            time.sleep(base_delay * (2**attempt))
        except Exception:
            return None
    return None

def get_coordinates_google(location_name, api_key):
    base_url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": location_name,
        "key": api_key
    }
    try:
      response = requests.get(base_url, params=params, timeout=10)
      response.raise_for_status()
      data = response.json()
      if data["status"] == "OK" and data["results"]:
            location = data["results"][0]["geometry"]["location"]
            return {"latitude": location["lat"], "longitude": location["lng"]}
    except Exception:
        return None
    return None

def get_coordinates(location_name):
    """Get coordinates, using cache first, then OSM, then Google Maps (if key available)."""
    if location_name in cache:
        return cache[location_name]

    # Try OSM
    coordinates = get_coordinates_osm(location_name)
    if coordinates:
        cache[location_name] = coordinates
        return coordinates
    
    # If OSM fails and Google Maps API Key is available, try Google Maps
    global use_google_maps
    if use_google_maps:
      coordinates = get_coordinates_google(location_name, GOOGLE_MAPS_API_KEY)
      if coordinates:
        cache[location_name] = coordinates
        return coordinates
    return None

def add_coordinates(reports_file):
    """Adds coordinates to each location in the reports data."""
    try:
        with open(reports_file, 'r', encoding='utf-8') as f:
            reports = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found: {reports_file}")
        return
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        return
    
    reports_list = reports.get("reports", [])
    for i, report in enumerate(tqdm(reports_list, desc="Processing reports")):
        report["geocoded_locations"] = {}  # Initialize a dict for coordinates
        try:
            if "locations" in report:
                for location in report["locations"]:
                    location_name = location.get("location_name")
                    maps_query_location = location.get("maps_query_location")
                    
                    if location_name is not None:
                       coordinates = get_coordinates(location_name)
                       if coordinates:
                          report["geocoded_locations"][location_name] = coordinates
                       continue #skip map query location
                    
                    if maps_query_location is not None:
                        coordinates = get_coordinates(maps_query_location)
                        if coordinates:
                           report["geocoded_locations"][maps_query_location] = coordinates
        except Exception as e:
                print(f"Error processing report at line {i + 1} : {e}")
                traceback.print_exc()

    try:
        with open(reports_file, 'w', encoding='utf-8') as f:
            json.dump(reports, f, indent=2, ensure_ascii=False)
    except Exception as e:
          print(f"Error when writing to json file: {e}")
          return

# Main execution
if __name__ == "__main__":
    reports_file = "merged_reports.json"
    add_coordinates(reports_file)
    cache.close()  # Close the cache when done
    print("merged_reports.json updated")