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

    # an array of report objects, each with lat and lon
    coords = []
    for report in all_reports:
        if 'geocoded_locations' in report and report['geocoded_locations']:
            for location, coords_data in report['geocoded_locations'].items():
                if coords_data and 'latitude' in coords_data and 'longitude' in coords_data:
                    coords.append({
                        'lat': coords_data['latitude'],
                        'lon': coords_data['longitude'],
                        'title': report['title'],
                        'flowers': ', '.join(report['flowers']),
                        'date': report['date'],
                        'description': '\n'.join(report['description'])
                    })
        # handle reports with multiple coordinates
        elif 'coordinates' in report and report['coordinates'] is not None:
            for c in report['coordinates']:
                if c is not None and 'lat' in c and 'lon' in c:
                    coords.append({
                        'lat': c['lat'],
                        'lon': c['lon'],
                        'title': report['title'],
                        'flowers': ', '.join(report['flowers']),
                        'date': report['date'],
                        'description': '\n'.join(report['description'])
                    })

    return render_template('map.html', coords_list=coords)

if __name__ == '__main__':
    app.run(debug=True)
