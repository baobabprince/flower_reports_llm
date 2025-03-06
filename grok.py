import requests
from bs4 import BeautifulSoup, NavigableString
import json
import os
import time
import logging
import csv
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
import google.generativeai as genai
from google.api_core import exceptions

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Read API keys and model from environment variables
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
LOCATIONIQ_API_KEY = os.getenv('LOCATIONIQ_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')

if not GEMINI_API_KEY or not LOCATIONIQ_API_KEY:
    logger.error("Missing API keys. Please set GEMINI_API_KEY and LOCATIONIQ_API_KEY environment variables.")
    raise ValueError("API keys not found in environment variables")

# Configure Gemini API
genai.configure(api_key=GEMINI_API_KEY)
logger.info(f"Using Gemini model: {GEMINI_MODEL}")
try:
    model = genai.GenerativeModel(GEMINI_MODEL)
except Exception as e:
    logger.error(f"Failed to initialize Gemini model '{GEMINI_MODEL}': {e}")
    raise

# Files
DATA_FILE = "wildflowers_data.json"
GEOCACHE_FILE = "geocache.csv"

# Set up requests session with retries
session = requests.Session()
retry_strategy = Retry(
    total=3,
    status_forcelist=[502, 503, 504],
    backoff_factor=1
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("https://", adapter)

# Load geocache from CSV
def load_geocache():
    geocache = {}
    if os.path.exists(GEOCACHE_FILE):
        try:
            with open(GEOCACHE_FILE, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    geocache[row['location']] = {
                        'lat': float(row['lat']) if row['lat'] else None,
                        'lon': float(row['lon']) if row['lon'] else None
                    }
                logger.info(f"Loaded {len(geocache)} locations from geocache")
        except Exception as e:
            logger.error(f"Error loading geocache: {e}")
    else:
        logger.info("No geocache file found, starting fresh")
    return geocache

# Save geocache to CSV
def save_geocache(geocache):
    try:
        with open(GEOCACHE_FILE, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['location', 'lat', 'lon'])
            writer.writeheader()
            for location, coords in geocache.items():
                writer.writerow({
                    'location': location,
                    'lat': coords['lat'] if coords else '',
                    'lon': coords['lon'] if coords else ''
                })
        logger.info(f"Saved {len(geocache)} locations to geocache")
    except Exception as e:
        logger.error(f"Error saving geocache: {e}")

# Global geocache
geocache = load_geocache()

def load_existing_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    logger.warning(f"{DATA_FILE} is empty, starting fresh")
                    return []
                data = json.loads(content)
                logger.info(f"Loaded {len(data)} existing reports from {DATA_FILE}")
                return data
        except json.JSONDecodeError as e:
            logger.error(f"Error loading existing data, invalid JSON: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading existing data: {e}")
            return []
    logger.info(f"No existing data file found at {DATA_FILE}")
    return []

def save_data(data):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved {len(data)} reports to {DATA_FILE}")
    except Exception as e:
        logger.error(f"Error saving data: {e}")

def scrape_page(page_num):
    url = f"https://www.wildflowers.co.il/hebrew/flash.asp?page={page_num}"
    logger.info(f"Scraping page: {url}")
    
    try:
        response = session.get(url, timeout=45)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        content = soup.find('div', class_='aboutBody')
        if not content:
            logger.warning(f"No content found with class 'aboutBody' on page {page_num}")
            return []
            
        bold_tags = content.find_all('b')
        logger.info(f"Found {len(bold_tags)} bold tags on page {page_num}")
        
        reports = []
        for bold_tag in bold_tags:
            report = {
                'title': bold_tag.get_text(strip=True),
                'date': '',
                'description': [],
                'reporter': '',
                'links': []
            }
            
            current = bold_tag.next_sibling
            while current:
                if isinstance(current, BeautifulSoup) and current.name == 'b':
                    break
                if isinstance(current, NavigableString):
                    text = current.strip()
                    if text:
                        if text.startswith('תאריך:'):
                            report['date'] = text.replace('תאריך:', '').strip()
                        else:
                            report['description'].append(text)
                elif isinstance(current, BeautifulSoup):
                    if current.name == 'a':
                        if 'mailto:' in current.get('href', ''):
                            report['reporter'] = current.get_text(strip=True)
                        elif 'http' in current.get('href', ''):
                            report['links'].append({
                                'text': current.get_text(strip=True),
                                'url': current['href']
                            })
                    elif current.name == 'br':
                        next_sib = current.next_sibling
                        if next_sib and isinstance(next_sib, BeautifulSoup) and next_sib.name == 'br':
                            break
                
                current = current.next_sibling if current else None
            
            if report['title'] and report['date'] and not report['title'].startswith(('סך הכל:', '[', 'דווחים')):
                reports.append(report)
        
        logger.info(f"Extracted {len(reports)} valid reports from page {page_num}")
        return reports
    except requests.exceptions.RequestException as e:
        logger.error(f"Error scraping page {page_num}: {e}")
        return None

def extract_flower_and_location(report):
    report_text = f"{report['title']}\n" + "\n".join(report['description'])
    
    # Primary prompt - providing more explicit instructions and examples
    prompt1 = f"""Given the following Hebrew text about flower sightings, extract:
    1. The names of flowers mentioned (like כלניות, רקפות, נרקיסים, איריס הארגמן, etc.)
    2. All location names mentioned (like ירושלים, הר הכרמל, פארק הירקון, מעגן מיכאל, etc.)
    
    Text:
    {report_text}
    
    Important: Even for very short texts, try to find at least one flower and one location.
    Return the result in this exact format:
    Flowers: [flower1, flower2, flower3]
    Locations: [location1, location2, location3]
    """
    
    # Alternative prompt for retry - more specific with examples
    prompt2 = f"""Analyze this Hebrew text about flower sightings and identify:
    1. Any flowers or plants mentioned - including common flowers like:
       - כלניות (anemones)
       - רקפות (cyclamen)
       - נרקיסים (narcissus)
       - איריס/אירוס (iris)
       - שקדיות (almond blossoms)
       - עירית (asphodel)
    
    2. Any locations or place names mentioned - including:
       - Cities/towns (e.g., ירושלים, תל אביב)
       - Mountains/hills (e.g., הר כרמל, גבעת...)
       - Parks/reserves (e.g., פארק הירקון, שמורת...)
       - Rivers/streams (e.g., נחל...)
    
    Text:
    {report_text}
    
    Provide the output in exactly this format:
    Flowers: [flower1, flower2, flower3]
    Locations: [location1, location2, location3]
    
    If no flowers or locations are found, return empty lists but maintain the format.
    """
    
    # Add a third prompt as final fallback - extremely direct and simple
    prompt3 = f"""Extract from this Hebrew text:
    1. A list of flower names
    2. A list of location names
    
    Input text: {report_text}
    
    Output (format exactly like this):
    Flowers: [flower1, flower2]
    Locations: [location1, location2]
    """
    
    prompts = [prompt1, prompt2, prompt3]
    max_retries = 5
    error_stats = {"empty_results": 0, "resource_exhausted": 0, "other_errors": 0}
    
    for attempt in range(max_retries):
        for prompt_index, prompt in enumerate(prompts):
            try:
                logger.info(f"Sending request to Gemini API for report: {report['title']} (prompt {prompt_index+1})")
                logger.debug(f"Text sent to Gemini: {report_text}")
                response = model.generate_content(prompt)
                text = response.text
                
                flowers = []
                locations = []
                
                for line in text.split('\n'):
                    if line.startswith('Flowers:'):
                        flowers_str = line.replace('Flowers:', '').strip(' []')
                        flowers = [f.strip(" '\"") for f in flowers_str.split(',') if f.strip()]
                    elif line.startswith('Locations:'):
                        locations_str = line.replace('Locations:', '').strip(' []')
                        locations = [l.strip(" '\"") for l in locations_str.split(',') if l.strip()]
                
                if flowers or locations:  # Success if either list is non-empty
                    logger.info(f"Extracted flowers: {flowers}, locations: {locations}")
                    logger.info(f"Extraction stats: {error_stats}")
                    time.sleep(4)
                    return flowers, locations
                else:
                    error_stats["empty_results"] += 1
                    logger.warning(f"Empty extraction from Gemini (prompt {prompt_index+1}), retrying (empty results: {error_stats['empty_results']})")
                    if prompt_index == len(prompts) - 1 and attempt < max_retries - 1:
                        wait_time = 5 * (2 ** attempt)
                        logger.warning(f"All prompts failed, waiting {wait_time} seconds before next attempt")
                        time.sleep(wait_time)
            except exceptions.ResourceExhausted as e:
                error_stats["resource_exhausted"] += 1
                wait_time = 5 * (2 ** attempt)
                logger.warning(f"Gemini API quota exceeded (attempt {attempt+1}/{max_retries}): {e}. Waiting {wait_time} seconds. Error count: {error_stats['resource_exhausted']}")
                time.sleep(wait_time)
            except Exception as e:
                error_stats["other_errors"] += 1
                logger.error(f"Error with Gemini API: {e}. Error count: {error_stats['other_errors']}")
                logger.error(f"Error type: {type(e).__name__}, Error details: {str(e)}")
                time.sleep(2)
                
                # Try one more approach with a minimal prompt if we've had multiple errors
                if error_stats["other_errors"] >= 3:
                    try:
                        logger.info("Attempting minimal fallback prompt as last resort")
                        minimal_prompt = f"Extract flower names and location names from this text: {report['title']}"
                        fallback_response = model.generate_content(minimal_prompt)
                        logger.info(f"Fallback response: {fallback_response.text}")
                        # Extract whatever we can from the response
                        # At this point, any data is better than nothing
                        return [], []
                    except:
                        logger.error("Even minimal fallback failed")
                        return [], []
                return [], []
    
    logger.error(f"Failed to extract from Gemini for report: {report['title']} after all retries. Error stats: {error_stats}")
    # Report would be empty, not useful to add it
    return [], []

def get_coordinates(locations):
    if not locations:
        return []
    
    coordinates = []
    new_entries = False
    
    for location in locations:
        if location in geocache:
            coords = geocache[location]
            logger.info(f"Using cached coordinates for {location}: {coords}")
            coordinates.append(coords)
        else:
            url = "https://api.locationiq.com/v1/autocomplete.php"
            params = {
                'key': LOCATIONIQ_API_KEY,
                'q': location,
                'limit': 1,
                'countrycodes': 'il'
            }
            
            try:
                logger.info(f"Requesting coordinates for location: {location}")
                response = session.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                if data and isinstance(data, list) and len(data) > 0:
                    coords = {'lat': float(data[0]['lat']), 'lon': float(data[0]['lon'])}
                    logger.info(f"Got coordinates for {location}: {coords}")
                else:
                    logger.warning(f"No coordinates found for {location}")
                    coords = None
                
                geocache[location] = coords
                coordinates.append(coords)
                new_entries = True
            except Exception as e:
                logger.error(f"Error with LocationIQ API for {location}: {e}")
                coordinates.append(None)
                geocache[location] = None
                new_entries = True
            
            time.sleep(1)
    
    if new_entries:
        save_geocache(geocache)
    
    return coordinates

def main():
    existing_data = load_existing_data()
    existing_titles_dates = {(r['title'], r['date']) for r in existing_data}
    
    if existing_data:
        reports_per_page = 10
        last_processed_page = (len(existing_data) // reports_per_page)
        page_num = last_processed_page + 1
        logger.info(f"Starting from page {page_num} based on {len(existing_data)} existing reports")
    else:
        page_num = 1
        logger.info("Starting from page 1 as no existing data found")
    
    new_data = []
    max_retries = 3
    retry_count = 0
    
    while True:
        reports = scrape_page(page_num)
        
        if reports is None:
            retry_count += 1
            if retry_count > max_retries:
                logger.error(f"Max retries ({max_retries}) reached, stopping at page {page_num}")
                break
            logger.info(f"Retrying page {page_num} (attempt {retry_count}/{max_retries})")
            time.sleep(5)
            continue
        elif not reports:
            logger.info(f"No more reports found on page {page_num}, stopping")
            break
            
        retry_count = 0
        
        page_has_new_data = False
        for report in reports:
            title_date = (report['title'], report['date'])
            if title_date not in existing_titles_dates:
                logger.info(f"Processing new report: {report['title']}")
                flowers, locations = extract_flower_and_location(report)
                coordinates = get_coordinates(locations)
                
                processed_report = {
                    'title': report['title'],
                    'date': report['date'],
                    'description': report['description'],
                    'reporter': report['reporter'],
                    'links': report['links'],
                    'flowers': flowers,
                    'locations': locations,
                    'coordinates': coordinates
                }
                
                new_data.append(processed_report)
                existing_titles_dates.add(title_date)
                page_has_new_data = True
        
        if page_has_new_data:
            page_num += 1
        else:
            logger.info(f"No new reports on page {page_num}, checking next page")
            page_num += 1
        
        if new_data:
            all_data = existing_data + new_data
            save_data(all_data)
            logger.info(f"Processed page {page_num-1}, added {len(new_data)} new reports")
            new_data = []
        
        time.sleep(2)
    
    logger.info("Scraping completed")

if __name__ == "__main__":
    main()
