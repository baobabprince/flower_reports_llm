import json
import os

def load_data():
    """Loads the processed wildflower data from the JSON file."""
    try:
        with open('wildflowers_data.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except json.JSONDecodeError:
        return []

def parse_date(date_str):
    try:
        if not date_str: return 0
        parts = date_str.split('/')
        if len(parts) == 3:
            return int(parts[2]) * 10000 + int(parts[1]) * 100 + int(parts[0])
        return 0
    except:
        return 0

def generate_coords():
    all_reports = load_data()
    # Sort reports by date (descending)
    all_reports.sort(key=lambda x: parse_date(x.get('date')), reverse=True)

    coords = []
    marker_count = 0
    MAX_MARKERS = 50000 # Increased limit for static page

    for report in all_reports:
        # handle geocoded_locations (dict of named locations -> {latitude, longitude})
        if 'geocoded_locations' in report and report['geocoded_locations']:
            for location, coords_data in report['geocoded_locations'].items():
                lat = coords_data.get('latitude') if coords_data else None
                lon = coords_data.get('longitude') if coords_data else None
                if lat is None or lon is None:
                    continue
                try:
                    latf = float(lat)
                    lonf = float(lon)
                except Exception:
                    continue
                
                coords.append({
                    'lat': latf,
                    'lon': lonf,
                    'title': report.get('title') or location,
                    'flowers': ', '.join([str(f) for f in (report.get('flowers') or []) if f]),
                    'date': report.get('date'),
                    'description': '\n'.join([str(d) for d in (report.get('description') or []) if d]),
                    'source': 'tiuli' if report.get('source_file') else 'merged'
                })
                marker_count += 1
                if marker_count >= MAX_MARKERS: break

        # handle reports with multiple coordinates
        elif 'coordinates' in report and report['coordinates']:
            for c in report['coordinates']:
                if not c or c.get('lat') is None or c.get('lon') is None:
                    continue
                try:
                    latf = float(c['lat'])
                    lonf = float(c['lon'])
                except Exception:
                    continue
                
                coords.append({
                    'lat': latf,
                    'lon': lonf,
                    'title': report.get('title'),
                    'flowers': ', '.join([str(f) for f in (report.get('flowers') or []) if f]),
                    'date': report.get('date'),
                    'description': '\n'.join([str(d) for d in (report.get('description') or []) if d]),
                    'source': 'tiuli' if report.get('source_file') else 'merged'
                })
                marker_count += 1
                if marker_count >= MAX_MARKERS: break
        
        if marker_count >= MAX_MARKERS: break

    return coords

def main():
    print("Generating coordinates...")
    coords = generate_coords()
    
    print(f"Saving {len(coords)} coordinates to data.json...")
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(coords, f, ensure_ascii=False) # Minified for production

    print("Generating index.html...")
    with open('templates/map.html', 'r', encoding='utf-8') as f:
        template = f.read()

    # Replace absolute static paths with relative ones
    template = template.replace('"/static/', '"static/')
    template = template.replace("'/static/", "'static/")
    
    # Replace the Jinja2 block with the actual data embedded
    # We look for the specific pattern in map.html
    import re
    json_data = json.dumps(coords, ensure_ascii=False)
    template = re.sub(r'<script>\s*const ALL_REPORTS = .*?;\s*</script>', 
                      f'<script>const ALL_REPORTS = {json_data};</script>', 
                      template, flags=re.DOTALL)

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(template)
    
    print("Static files generated successfully!")

if __name__ == '__main__':
    main()