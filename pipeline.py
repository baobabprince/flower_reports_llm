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
import re
from google.api_core import exceptions
from dotenv import load_dotenv

load_dotenv()

# --- Logging Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- Configuration and Initialization ---

def init_gemini():
    """Initializes and returns the Gemini API model."""
    gemini_api_key = os.getenv('GEMINI_API_KEY')
    if not gemini_api_key:
        logger.warning("GEMINI_API_KEY not found in environment variables. Gemini features will be disabled.")
        return None
    genai.configure(api_key=gemini_api_key)
    
    models_to_try = [
        os.getenv('GEMINI_MODEL', 'gemini-1.5-flash'),
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash-exp',
        'gemini-1.0-pro'
    ]
    
    # Remove duplicates while preserving order
    models_to_try = list(dict.fromkeys(models_to_try))

    for model_name in models_to_try:
        try:
            logger.info(f"Attempting to initialize Gemini model: {model_name}")
            model = genai.GenerativeModel(model_name)
            # Test the model with a simple prompt to ensure it's accessible
            response = model.generate_content("Test")
            logger.info(f"Successfully initialized Gemini model: {model_name}")
            return model
        except Exception as e:
            logger.warning(f"Failed to initialize model '{model_name}': {e}")
    
    logger.error("All Gemini models failed to initialize.")
    return None

def init_requests_session():
    """Initializes and returns a requests session with retries."""
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        status_forcelist=[502, 503, 504],
        backoff_factor=1
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    return session

# --- Data Caching and Storage ---

def load_geocache(filepath="geocache.csv"):
    """Loads the geocache from a CSV file."""
    geocache = {}
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
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

def save_geocache(geocache, filepath="geocache.csv"):
    """Saves the geocache to a CSV file."""
    try:
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
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

def load_existing_data(filepath="wildflowers_data.json"):
    """Loads existing reports from a JSON file."""
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    logger.warning(f"{filepath} is empty, starting fresh")
                    return []
                return json.loads(content)
        except json.JSONDecodeError as e:
            logger.error(f"Error loading existing data, invalid JSON: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading existing data: {e}")
            return []
    logger.info(f"No existing data file found at {filepath}")
    return []

def save_data(data, filepath="wildflowers_data.json"):
    """Saves reports to a JSON file."""
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved {len(data)} reports to {filepath}")
    except Exception as e:
        logger.error(f"Error saving data: {e}")

# --- Data Sources and Scraping ---

def scrape_wildflowers_page(page_num, session):
    """Scrapes a single page from wildflowers.co.il."""
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
        reports = []
        for bold_tag in bold_tags:
            report = {
                'title': bold_tag.get_text(strip=True),
                'date': '',
                'description': [],
                'reporter': '',
                'links': []
            }
            # The date is usually in the text following the title
            date_tag = bold_tag.find_next(string=re.compile(r'תאריך:'))
            if date_tag:
                report['date'] = date_tag.replace('תאריך:', '').strip()

            # The reporter is usually in a mailto link
            reporter_link = bold_tag.find_next('a', href=re.compile('mailto:'))
            if reporter_link:
                report['reporter'] = reporter_link.get_text(strip=True)

            # Get the description text
            description_text = ''
            for sibling in bold_tag.next_siblings:
                if sibling.name == 'b':
                    break
                if isinstance(sibling, NavigableString):
                    text = sibling.strip()
                    if text and not text.startswith('תאריך:'):
                        description_text += text + '\n'
            report['description'] = [d.strip() for d in description_text.strip().split('\n') if d.strip()]
            if report['title'] and report['date'] and not report['title'].startswith(('סך הכל:', '[', 'דווחים')):
                reports.append(report)
        logger.info(f"Extracted {len(reports)} valid reports from page {page_num}")
        return reports
    except requests.exceptions.RequestException as e:
        logger.error(f"Error scraping page {page_num}: {e}")
        return None

# --- Data Extraction (LLM) ---

def extract_flower_and_location(report, model):
    """Extracts flower and location data from a report using the Gemini API."""
    report_text = f"{report['title']}\n" + "\n".join(report['description'])
    prompts = [
        f"""Given the following Hebrew text about flower sightings, extract:
        1. The names of flowers mentioned.
        2. All location names mentioned.
        Text:
        {report_text}
        Return the result in this exact format:
        Flowers: [flower1, flower2, flower3]
        Locations: [location1, location2, location3]
        """,
        # ... (add other prompts if needed)
    ]
    max_retries = 3
    for attempt in range(max_retries):
        for prompt in prompts:
            try:
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
                if flowers or locations:
                    logger.info(f"Extracted flowers: {flowers}, locations: {locations}")
                    time.sleep(4)
                    return flowers, locations
            except exceptions.ResourceExhausted as e:
                logger.warning(f"Gemini API quota exceeded: {e}. Retrying...")
                time.sleep(5 * (2 ** attempt))
            except Exception as e:
                logger.error(f"Error with Gemini API: {e}")
                time.sleep(2)
    logger.error(f"Failed to extract from Gemini for report: {report['title']}")
    return [], []

# --- Geocoding ---

def get_coordinates(locations, geocache, session):
    """Gets coordinates for a list of locations using the LocationIQ API."""
    if not locations:
        return []
    api_key = os.getenv('LOCATIONIQ_API_KEY')
    if not api_key:
        logger.warning("LOCATIONIQ_API_KEY not found in environment variables. Skipping geocoding.")
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
            params = {'key': api_key, 'q': location, 'limit': 1, 'countrycodes': 'il'}
            try:
                response = session.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                if data and isinstance(data, list) and len(data) > 0:
                    coords = {'lat': float(data[0]['lat']), 'lon': float(data[0]['lon'])}
                else:
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

# --- Main Processing Pipeline ---


def process_tiuli_files(existing_data, geocache, session, html_dir='tiuli_scraped_reports'):
    """Processes HTML files from the tiuli_scraped_reports directory."""
    logger.info("Processing Tiuli HTML files...")
    if not os.path.exists(html_dir):
        logger.warning(f"Directory '{html_dir}' not found.")
        return []

    new_reports = []
    existing_reports_keys = set()
    for report in existing_data:
        if 'source_file' in report and 'original_text' in report:
            existing_reports_keys.add((report['source_file'], report['original_text']))


    for filename in os.listdir(html_dir):
        if filename.endswith(".html"):
            filepath = os.path.join(html_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as file:
                    html_content = file.read()
                    soup = BeautifulSoup(html_content, 'html.parser')
                    articles = soup.find_all('article', class_='shadow-card')
                    for article in articles:
                        original_text_element = article.find('div', class_='mt-1', recursive=False)
                        original_text = original_text_element.get_text(strip=True) if original_text_element else ""

                        if (filepath, original_text) in existing_reports_keys:
                            continue

                        # ... (rest of the extraction logic from tiuli_parse.py)
                        report = {}

                        # Extract user details
                        user_details = article.find('div', class_='user-details')
                        observer_element = user_details.find('span', class_='text-grey-900')
                        observer = observer_element.get_text(strip=True) if observer_element else None

                        date_element = user_details.find('span', class_='text-grey-700')
                        date = date_element.get_text(strip=True) if date_element else None

                        report['date'] = date
                        report['observer'] = observer


                        # Extract report details
                        report_details = article.find('div', class_='report-details')
                        original_text = ""
                        if report_details:
                            original_text_element = report_details.find('div', class_='mt-1')
                            if original_text_element:
                                original_text = original_text_element.get_text(strip=True)

                        flower_name_element = report_details.find('h2', class_='m-0 font-bold text-lg lg:text-2xl').find('a')
                        flower_name = flower_name_element.get_text(strip=True) if flower_name_element else None
                        location_element = report_details.find('span', string=re.compile(r'מיקום:.*'))
                        location = location_element.get_text(strip=True).replace("מיקום: ", "") if location_element else None

                        report['title'] = flower_name
                        report['description'] = [original_text]
                        report['locations'] = [location]
                        report['flowers'] = [flower_name]

                        # Extract Waze and map button data, and extract coordinates if available.
                        geocoded_locations = {}
                        buttons = article.find_all('button', class_='mobx', attrs={"data-type": "iframe"})
                        waze_link = article.find('a', class_='lg:ml-2', href=re.compile(r'waze.com/ul\?navigate=yes'))

                        for button in buttons:
                            data_src = button.get('data-src')
                            if data_src and 'marker_lat=' in data_src and 'marker_lon=' in data_src:
                                 try:
                                        lat_match = re.search(r'marker_lat=([\d.]+)', data_src)
                                        lon_match = re.search(r'marker_lon=([\d.]+)', data_src)
                                        if lat_match and lon_match:
                                            latitude = float(lat_match.group(1))
                                            longitude = float(lon_match.group(1))
                                            geocoded_locations[location] = {"latitude": latitude, "longitude": longitude}
                                 except:
                                        pass
                        report['coordinates'] = []
                        if geocoded_locations :
                            for location, coords in geocoded_locations.items():
                                report['coordinates'].append({'lat': coords['latitude'], 'lon': coords['longitude']})
                        else:
                            report['coordinates'] = get_coordinates(report['locations'], geocache, session)

                        report['source_file'] = filepath
                        new_reports.append(report)

            except Exception as e:
                logger.error(f"Error processing {filename}: {e}")
    logger.info(f"Found {len(new_reports)} new reports from Tiuli files.")
    return new_reports

def process_local_wildflowers_files(existing_data, geocache, model, session, data_dir='data'):
    """Processes local HTML files from the data directory (wildflowers.co.il format)."""
    # Removed the check that returns if model is None. We will use fallback.
    
    logger.info(f"Processing local files in {data_dir}...")
    if not os.path.exists(data_dir):
        logger.warning(f"Directory '{data_dir}' not found.")
        return []

    existing_titles_dates = {(r.get('title'), r.get('date')) for r in existing_data}
    new_data = []

    # Process files matching page_*.html
    for filename in os.listdir(data_dir):
        if filename.startswith('page_') and filename.endswith('.html'):
            filepath = os.path.join(data_dir, filename)
            # logger.info(f"Processing local file: {filename}") # Reduce noise
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    html_content = f.read()
                
                soup = BeautifulSoup(html_content, 'html.parser')
                content = soup.find('div', class_='aboutBody')
                if not content:
                    logger.warning(f"No content found with class 'aboutBody' in {filename}")
                    continue

                bold_tags = content.find_all('b')
                reports = []
                for bold_tag in bold_tags:
                    report = {
                        'title': bold_tag.get_text(strip=True),
                        'date': '',
                        'description': [],
                        'reporter': '',
                        'links': []
                    }
                    # The date is usually in the text following the title
                    date_tag = bold_tag.find_next(string=re.compile(r'תאריך:'))
                    if date_tag:
                        report['date'] = date_tag.replace('תאריך:', '').strip()

                    # The reporter is usually in a mailto link
                    reporter_link = bold_tag.find_next('a', href=re.compile('mailto:'))
                    if reporter_link:
                        report['reporter'] = reporter_link.get_text(strip=True)

                    # Get the description text
                    description_text = ''
                    for sibling in bold_tag.next_siblings:
                        if sibling.name == 'b':
                            break
                        if isinstance(sibling, NavigableString):
                            text = sibling.strip()
                            if text and not text.startswith('תאריך:'):
                                description_text += text + '\n'
                    report['description'] = [d.strip() for d in description_text.strip().split('\n') if d.strip()]
                    
                    if report['title'] and report['date'] and not report['title'].startswith(('סך הכל:', '[', 'דווחים')):
                         # Check against existing data immediately to save API calls
                        title_date = (report['title'], report['date'])
                        if title_date not in existing_titles_dates:
                            reports.append(report)

                # Process extracted reports from this file
                for report in reports:
                    flowers = []
                    locations = []
                    
                    if model:
                        flowers, locations = extract_flower_and_location(report, model)
                    
                    # Fallback if no locations found or model missing
                    if not locations:
                        # Use title as a potential location
                        clean_title = report['title'].replace('פריחה ב', '').replace('פריחת', '').strip()
                        locations.append(clean_title)
                        # Also look for "location:" pattern if it existed in description (less likely in this source)

                    coordinates = get_coordinates(locations, geocache, session)
                    processed_report = {
                        **report,
                        'flowers': flowers,
                        'locations': locations,
                        'coordinates': coordinates,
                        'source_file': filename # Track source
                    }
                    new_data.append(processed_report)
                    existing_titles_dates.add((report['title'], report['date']))
                    
            except Exception as e:
                logger.error(f"Error processing {filename}: {e}")

    logger.info(f"Found {len(new_data)} new reports from local files.")
    return new_data

def process_wildflowers_website(existing_data, geocache, model, session):
    """Main pipeline to process the wildflowers.co.il website."""
    if model is None:
        logger.warning("Gemini model is not available. Skipping wildflowers.co.il processing.")
        return []

    logger.info("Processing wildflowers.co.il...")
    existing_titles_dates = {(r.get('title'), r.get('date')) for r in existing_data}

    page_num = 1
    new_data = []
    while True:
        reports = scrape_wildflowers_page(page_num, session)
        if not reports:
            break
        page_has_new_data = False
        for report in reports:
            title_date = (report['title'], report['date'])
            if title_date not in existing_titles_dates:
                flowers, locations = extract_flower_and_location(report, model)
                coordinates = get_coordinates(locations, geocache, session)
                processed_report = {
                    **report,
                    'flowers': flowers,
                    'locations': locations,
                    'coordinates': coordinates
                }
                new_data.append(processed_report)
                existing_titles_dates.add(title_date)
                page_has_new_data = True
        if not page_has_new_data:
            logger.info(f"No new reports on page {page_num}, stopping.")
            break
        page_num += 1
        time.sleep(2)
    logger.info(f"Found {len(new_data)} new reports from wildflowers.co.il.")
    return new_data

def main():
    """Main function to run the data processing pipeline."""
    model = init_gemini()
    session = init_requests_session()
    geocache = load_geocache()
    existing_data = load_existing_data()

    wildflowers_data = process_wildflowers_website(existing_data, geocache, model, session)
    local_data = process_local_wildflowers_files(existing_data, geocache, model, session)
    tiuli_data = process_tiuli_files(existing_data, geocache, session)

    all_data = existing_data + wildflowers_data + local_data + tiuli_data
    save_data(all_data)
    logger.info("Data processing pipeline completed.")


if __name__ == '__main__':
    main()
