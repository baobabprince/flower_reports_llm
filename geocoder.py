import json
import requests
from geopy.geocoders import Nominatim
import os
from dotenv import load_dotenv
load_dotenv()
import shelve
import time
from requests.exceptions import ReadTimeout

# Initialize Nominatim geocoder (OSM)
geolocator = Nominatim(user_agent="my_geocoder")

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# Cache setup
CACHE_FILE = "geocache.db"
cache = shelve.open(CACHE_FILE, writeback=True)

def get_coordinates_osm(location_name, max_retries=3, base_delay=1):
    print(f"Trying OSM for: {location_name}")
    for attempt in range(max_retries):
        try:
            location = geolocator.geocode(location_name, timeout=10)
            if location:
                print(f"OSM success for: {location_name}, coordinates: {location.latitude}, {location.longitude}")
                return {"latitude": location.latitude, "longitude": location.longitude}
            else:
                print(f"OSM failed for: {location_name}")
                return None
        except ReadTimeout as e:
             print(f"OSM timeout error: {e}. Retrying in {base_delay * (2**attempt)} seconds...")
             time.sleep(base_delay * (2**attempt))
        except Exception as e:
             print(f"Error in OSM geocoding: {e}")
             return None
    print(f"OSM failed after {max_retries} retries for: {location_name}")
    return None



def get_coordinates_google(location_name, api_key):
    print(f"Trying Google Maps for: {location_name}")
    base_url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": location_name,
        "key": api_key
    }
    try:
      response = requests.get(base_url, params=params, timeout=10)
      response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
      data = response.json()
      if data["status"] == "OK" and data["results"]:
            location = data["results"][0]["geometry"]["location"]
            print(f"Google Maps success for: {location_name}, coordinates: {location['lat']}, {location['lng']}")
            return {"latitude": location["lat"], "longitude": location["lng"]}
      else:
          print(f"Google Maps failed for: {location_name}")
          return None
    except Exception as e:
          print(f"Error in Google geocoding: {e}")
          return None

def get_coordinates(location_name):
    """Get coordinates, using cache first, then OSM, then Google Maps (if key available)."""
    print(f"Getting coordinates for: {location_name}")
    if location_name in cache:
        print(f"Using cache for: {location_name}")
        return cache[location_name]

    # Try OSM
    coordinates = get_coordinates_osm(location_name)
    if coordinates:
        cache[location_name] = coordinates
        print(f"Caching coordinates for: {location_name}")
        return coordinates
    
    # If OSM fails, try Google Maps (if key available)
    if GOOGLE_MAPS_API_KEY:
       coordinates = get_coordinates_google(location_name, GOOGLE_MAPS_API_KEY)
       if coordinates:
         cache[location_name] = coordinates
         print(f"Caching coordinates for: {location_name}")
         return coordinates
       else:
         print(f"Could not find coordinates for {location_name} using OSM or Google Maps.")
    else:
         print(f"Could not find coordinates for {location_name} using OSM. Please provide Google Maps API KEY to geocode this location")
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
    

    for report in reports["reports"]:
        report["geocoded_locations"] = {}  # Initialize a dict for coordinates

        if "locations" in report:
           for location in report["locations"]:
                location_name = location.get("location_name")
                maps_query_location = location.get("maps_query_location")
                
                if location_name:
                   coordinates = get_coordinates(location_name)
                   if coordinates:
                      report["geocoded_locations"][location_name] = coordinates
                      continue
                if maps_query_location:
                    coordinates = get_coordinates(maps_query_location)
                    if coordinates:
                       report["geocoded_locations"][maps_query_location] = coordinates
                  
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