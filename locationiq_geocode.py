import json
import pandas as pd
import requests
import time
from typing import Dict, Optional
import os

class LocationGeocoder:
    def __init__(self, api_key: str, cache_file: str = 'location_cache.csv'):
        """Initialize the geocoder with API key and cache file path."""
        self.api_key = api_key
        self.cache_file = cache_file
        self.cache = self._load_cache()
        self.base_url = "https://us1.locationiq.com/v1/search"
        
    def _load_cache(self) -> Dict[str, Optional[Dict[str, float]]]:
        """Load existing cache from CSV file or create new cache."""
        try:
            if os.path.exists(self.cache_file):
                print(f"Loading existing cache from {self.cache_file}")
                df = pd.read_csv(self.cache_file)
                cache = {}
                
                # Ensure status column exists
                if 'status' not in df.columns:
                    df['status'] = ['failed' if pd.isna(row['latitude']) else 'success' for _, row in df.iterrows()]
                
                for _, row in df.iterrows():
                    if row['status'] == 'failed' or pd.isna(row['latitude']) or pd.isna(row['longitude']):
                        # This was a failed geocoding attempt
                        print(f"Loading failed attempt for: {row['location']}")
                        cache[row['location']] = None
                    else:
                        cache[row['location']] = {
                            'latitude': row['latitude'],
                            'longitude': row['longitude']
                        }
                
                successful = sum(1 for v in cache.values() if v is not None)
                failed = sum(1 for v in cache.values() if v is None)
                print(f"Loaded {len(cache)} cached locations ({successful} successful, {failed} failed)")
                return cache
            return {}
        except Exception as e:
            print(f"Error loading cache: {e}")
            return {}

    def _save_cache(self):
        """Save current cache to CSV file."""
        try:
            # Convert cache to list of dictionaries including failed attempts
            cache_list = []
            print(f"Current cache size: {len(self.cache)} entries")
            
            for loc, coords in self.cache.items():
                if coords is None:
                    # Failed attempt
                    print(f"Saving failed attempt for: {loc}")
                    cache_list.append({
                        'location': loc,
                        'latitude': None,
                        'longitude': None,
                        'status': 'failed'
                    })
                else:
                    cache_list.append({
                        'location': loc,
                        'latitude': coords['latitude'],
                        'longitude': coords['longitude'],
                        'status': 'success'
                    })
            
            df = pd.DataFrame(cache_list)
            print(f"Saving cache with {len(df)} entries ({len(df[df['status'] == 'failed'])} failed, {len(df[df['status'] == 'success'])} successful)")
            df.to_csv(self.cache_file, index=False)
        except Exception as e:
            print(f"Error saving cache: {e}")

    def geocode_location(self, location: str) -> Optional[Dict[str, float]]:
        """Geocode a single location, using cache if available."""
        if location in self.cache:
            result = self.cache[location]
            status = "successful" if result is not None else "failed"
            print(f"Cache hit for location: {location} (previously {status})")
            return result

        try:
            params = {
                'key': self.api_key,
                'q': location,
                'format': 'json',
                'accept-language': 'he,en'
            }
            
            response = requests.get(self.base_url, params=params)
            
            # Hide API key in error message if request fails
            try:
                response.raise_for_status()
            except requests.exceptions.RequestException as e:
                # Create a sanitized error message without the API key
                error_msg = str(e)
                if self.api_key in error_msg:
                    error_msg = error_msg.replace(self.api_key, "API_KEY_HIDDEN")
                raise requests.exceptions.RequestException(error_msg)
            
            data = response.json()
            if data and len(data) > 0:
                coords = {
                    'latitude': float(data[0]['lat']),
                    'longitude': float(data[0]['lon'])
                }
                self.cache[location] = coords
                self._save_cache()
                print(f"Successfully geocoded: {location}")
                return coords
            
            print(f"No results found for location: {location}")
            # Cache the failed attempt
            print(f"Caching failed attempt for location: {location}")
            self.cache[location] = None
            self._save_cache()
            return None

        except requests.exceptions.RequestException as e:
            print(f"API error for location {location}: {e}")
            # Cache the failed attempt
        except Exception as e:
            sanitized_error = str(e)
            if self.api_key in sanitized_error:
                sanitized_error = sanitized_error.replace(self.api_key, "API_KEY_HIDDEN")
            print(f"Error geocoding location {location}: {sanitized_error}")
            # Cache the failed attempt
            self.cache[location] = None
            self._save_cache()
            return None

        finally:
            # Respect rate limits
            time.sleep(1)

def process_json_file(input_file: str, output_file: str, geocoder: LocationGeocoder):
    """Process JSON file and add coordinates where missing."""
    try:
        # Read JSON file
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        total_locations = 0
        processed_locations = 0
        
        # Process each report
        for report in data['reports']:
            if 'geocoded_locations' not in report:
                report['geocoded_locations'] = {}

            for location in report['locations']:
                total_locations += 1
                location_name = location['location_name']
                if location_name not in report['geocoded_locations']:
                    coords = geocoder.geocode_location(location_name)
                    if coords:
                        report['geocoded_locations'][location_name] = coords
                        processed_locations += 1

        # Save updated JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully processed {processed_locations} out of {total_locations} locations")
        print(f"Results saved to {output_file}")

    except Exception as e:
        print(f"Error processing JSON file: {e}")

def main():
    """Main function to run the geocoding process."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Geocode locations from a JSON file')
    parser.add_argument('--api-key', required=True, help='LocationIQ API key')
    parser.add_argument('--input-file', default='tiuli_reports.json', help='Input JSON file')
    parser.add_argument('--output-file', default='tiuli_reports_with_coords.json', help='Output JSON file')
    parser.add_argument('--cache-file', default='location_cache.csv', help='Cache file to use/create')
    
    args = parser.parse_args()
    
    geocoder = LocationGeocoder(args.api_key, args.cache_file)
    process_json_file(args.input_file, args.output_file, geocoder)

if __name__ == "__main__":
    main()