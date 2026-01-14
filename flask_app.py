import json
import os
from flask import Flask, render_template

app = Flask(__name__)

def load_data():
    """Loads the processed wildflower data from the JSON file."""
    try:
        with open('wildflowers_data.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except json.JSONDecodeError:
        return []

@app.route('/')
def index():
    """Renders the main map page."""
    return render_template('index.html')

@app.route('/reports')
def reports():
    """Renders a page with a list of all flowering reports."""
    all_reports = load_data()
    return render_template('report.html', reports=all_reports)

@app.route('/map')
def map_view():
    """Renders the map with all the flowering report locations."""
    all_reports = load_data()

    # an array of report objects, each with lat and lon (only valid numeric coords)
    coords = []
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
                    'title': report.get('title'),
                    'flowers': ', '.join(report.get('flowers', [])),
                    'date': report.get('date'),
                    'description': '\n'.join(report.get('description', []))
                })

        # handle reports with multiple coordinates
        if 'coordinates' in report and report['coordinates'] is not None:
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
                    'flowers': ', '.join(report.get('flowers', [])),
                    'date': report.get('date'),
                    'description': '\n'.join(report.get('description', []))
                })

    return render_template('map.html', coords_list=coords)

if __name__ == '__main__':
    app.run(debug=True)
