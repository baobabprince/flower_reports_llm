# generate_data.py
import os
import json
from flask_app import get_latest_reports

if __name__ == "__main__":
    err, reports = get_latest_reports(0, force=True)
    if err:
        print(err)
    else:
        with open('static/reports.json', 'w') as f:
            json.dump(reports, f)
