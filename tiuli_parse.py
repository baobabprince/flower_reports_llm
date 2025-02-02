import json
import os
from bs4 import BeautifulSoup
import re

def extract_data_from_html(html_content, source_file):
    soup = BeautifulSoup(html_content, 'html.parser')
    reports = []
    articles = soup.find_all('article', class_='shadow-card')

    for article in articles:
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
        original_text_element = report_details.find('div', class_='mt-1',recursive=False)
        original_text = original_text_element.get_text(strip=True) if original_text_element else ""
        report['original_text'] = original_text
        
        
        flower_name_element = report_details.find('h2', class_='m-0 font-bold text-lg lg:text-2xl').find('a')
        flower_name = flower_name_element.get_text(strip=True) if flower_name_element else None
        location_element = report_details.find('span', string=re.compile(r'מיקום:.*'))
        location = location_element.get_text(strip=True).replace("מיקום: ", "") if location_element else None
        
        report['locations'] = []
        
        
        maps_query_location = location if location else None
        report['locations'].append({
                "location_name": location,
                "flowers": [flower_name],
                "maps_query_location": maps_query_location
            })
        
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
        if geocoded_locations :
             report['geocoded_locations'] = geocoded_locations
        else:
            report['geocoded_locations'] = {}
        
        report['source_file'] = source_file

        reports.append(report)

    return reports


def process_html_files(html_dir):
    all_reports = []
    for filename in os.listdir(html_dir):
        if filename.endswith(".html"):
            filepath = os.path.join(html_dir, filename)
            try:
               with open(filepath, 'r', encoding='utf-8') as file:
                    html_content = file.read()
                    reports = extract_data_from_html(html_content, filepath)
                    all_reports.extend(reports)
            except Exception as e:
                print(f"Error processing {filename}: {e}")
    return {"reports": all_reports}

if __name__ == '__main__':
    html_directory = 'tiuli_scraped_reports'  # Directory with your HTML files
    output_file = "tiuli_reports.json"
    
    # Create the directory if it doesn't exist
    if not os.path.exists(html_directory):
        print(f"Error: Directory '{html_directory}' does not exist.")
        exit()
    
    formatted_data = process_html_files(html_directory)
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        json.dump(formatted_data, outfile, indent=2, ensure_ascii=False)

    print(f"Data extracted and saved to {output_file}")