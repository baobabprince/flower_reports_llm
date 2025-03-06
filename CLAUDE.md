# Claude Memory File for flower_reports_llm project

## Project Overview
This project scrapes and processes flower reporting data from websites, extracts information using LLMs, performs geocoding, and displays the results on a map.

## Build & Run Commands
- Start Flask server: `python flask_app.py`
- Process flower reports: `python processor.py`
- Geocode locations: `python geocoder.py`
- Scrape website data: `python grok.py`

## Code Style Guidelines
- **Naming**: Use `snake_case` for variables/functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants
- **Imports**: Group standard library first, then third-party packages, then local modules
- **Type Hints**: Use type annotations for function parameters and return values
- **Error Handling**: Use try/except blocks with specific exceptions; log errors with context
- **Logging**: Use Python's logging module with datetime, level, and descriptive messages
- **Documentation**: Add docstrings for functions/classes explaining purpose, parameters, and return values

## Environment Variables
- GEMINI_API_KEY: Required for LLM processing
- GOOGLE_MAPS_API_KEY/MAPS_API_KEY: For geocoding
- LOCATIONIQ_API_KEY: Alternative geocoding service