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
    """Renders the main map page with all the flowering report locations."""
    all_reports = load_data()
    return render_template('index.html', reports_json=json.dumps(all_reports))

@app.route('/reports')
def reports():
    """Renders a page with a list of all flowering reports."""
    all_reports = load_data()
    return render_template('report.html', reports=all_reports)

if __name__ == '__main__':
    app.run(debug=True)
