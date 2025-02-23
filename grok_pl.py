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

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
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
        logger.debug(f"Successfully fetched page {page_num}, status code: {response.status_code}")
        
        soup = BeautifulSoup(response.text, 'html.parser')
        content = soup.find('div', class_='aboutBody')
        if not content:
            logger.warning(f"No content found with class 'aboutBody' on page {page_num}")
            return []
            
        bold_tags = content.find_all('b')
        logger.info(f"Found {len(bold_tags)} bold tags on page {page_num}")
        
        reports = []
        for i, bold_tag in enumerate(bold_tags):
            report = {
                'title': bold_tag.get_text(strip=True),
                'date': '',
                'description': [],
                'reporter': '',
                'links': []
            }
            logger.debug(f"Processing bold tag {i} - Title: {report['title']}")
            
            current = bold_tag.next_sibling
            while current:
                if isinstance(current, BeautifulSoup) and current.name == 'b':
                    break  # Next report starts
                if isinstance(current, NavigableString):
                    text = current.strip()
                    if text:
                        if text.startswith('תאריך:'):
                            report['date'] = text.replace('תאריך:', '').strip()
                            logger.debug(f"Report {i} - Date: {report['date']}")
                        else:
                            report['description'].append(text)
                            logger.debug(f"Report {i} - Description: {text}")
                elif isinstance(current, BeautifulSoup):
                    if current.name == 'a':
                        if 'mailto:' in current.get('href', ''):
                            report['reporter'] = current.get_text(strip=True)
                            logger.debug(f"Report {i} - Reporter: {report['reporter']}")
                        elif 'http' in current.get('href', ''):
                            report['links'].append({
                                'text': current.get_text(strip=True),
                                'url': current['href']
                            })
                            logger.debug(f"Report {i} - Link: {report['links'][-1]}")
                    elif current.name == 'br':
                        next_sib = current.next_sibling
                        if next_sib and isinstance(next_sib, BeautifulSoup) and next_sib.name == 'br':
                            logger.debug(f"Report {i} - Double <br> detected, ending report")
                            break
                
                current = current.next_sibling if current else None
            
            logger.debug(f"Report {i} constructed: {report}")
            
            if report['title'] and report['date'] and not report['title'].startswith(('סך הכל:', '[', 'דווחים')):
                logger.info(f"Valid report found on page {page_num} - Title: {report['title']}")
                reports.append(report)
            else:
                logger.debug(f"Report {i} skipped - Invalid or metadata: Title: '{report['title']}', Date: '{report['date']}'")
        
        logger.info(f"Extracted {len(reports)} valid reports from page {page_num}")
        return reports
    except requests.exceptions.RequestException as e:
        logger.error(f"Error scraping page {page_num}: {e}")
        return None

def extract_flower_and_location(report):
    report_text = f"{report['title']}\n" + "\n".join(report['description'])
    prompt = f"""Given the following Hebrew text about flower sightings, extract:
    1. The names of flowers mentioned
    2. All location names mentioned (return as a list)
    
    Text:
    {report_text}
    
    Return the result in this format:
    Flowers: [list of flower names]
    Locations: [list of location names]
    """
    
    try:
        logger.info(f"Sending request to Gemini API for report: {report['title']}")
        logger.debug(f"Text sent to Gemini: {report_text}")
        response = model.generate_content(prompt)
        text = response.text
        
        flowers = []
        locations = []
        
        for line in text.split('\n'):
            if line.startswith('Flowers:'):
                flowers_str = line.replace('Flowers:', '').strip(' []')
                flowers = [f.strip(" '") for f in flowers_str.split(',') if f.strip()]
            elif line.startswith('Locations:'):
                locations_str = line.replace('Locations:', '').strip(' []')
                locations = [l.strip(" '") for l in locations_str.split(',') if l.strip()]
                
        logger.info(f"Extracted flowers: {flowers}, locations: {locations}")
        return flowers, locations
    except Exception as e:
        logger.error(f"Error with Gemini API: {e}")
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
                time.sleep(1)
            except Exception as e:
                logger.error(f"Error with LocationIQ API for {location}: {e}")
                coordinates.append(None)
                geocache[location] = None
                new_entries = True
    
    if new_entries:
        save_geocache(geocache)
    
    return coordinates

def main():
    existing_data = load_existing_data()
    existing_titles_dates = {(r['title'], r['date']) for r in existing_data}
    
    # Estimate starting page
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
                
                time.sleep(1)
            else:
                logger.debug(f"Skipping already processed report: {report['title']} ({report['date']})")
        
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
