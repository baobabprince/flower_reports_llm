# Flower Reports LLM

This project scrapes and parses flowering report data from various websites, processes it using a Large Language Model (LLM), and displays the results on an interactive map.

**Live Site:** [https://baobabprince.github.io/flower_reports_llm/](https://baobabprince.github.io/flower_reports_llm/)

## Project Structure

- **`pipeline.py`**: The main data processing pipeline. This script scrapes data from `wildflowers.co.il`, processes local HTML files from the `tiuli_scraped_reports` directory, extracts flower and location information using the Gemini API, and geocodes the locations using the LocationIQ API. The processed data is saved to `wildflowers_data.json`.
- **`background_worker.py`**: A background worker that runs the data processing pipeline every hour to keep the data fresh.
- **`flask_app.py`**: A simple Flask web application that serves the processed data and displays it on an interactive map.
- **`templates/`**: Contains the HTML templates for the web application.
- **`static/`**: Contains the static assets for the web application (CSS, JavaScript, etc.).
- **`wildflowers_data.json`**: The consolidated, processed data from all sources.
- **`geocache.csv`**: A cache of geocoded locations to avoid redundant API calls.

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/flower_reports_llm.git
    cd flower_reports_llm
    ```

2.  **Install the required dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Set up your environment variables:**
    -   Create a `.env` file by copying the `.env.example` file:
        ```bash
        cp .env.example .env
        ```
    -   Open the `.env` file and add your API keys for the Gemini API and the LocationIQ API.

## Running the Application

1.  **Run the data processing pipeline:**
    To perform an initial run of the data processing pipeline, execute the following command:
    ```bash
    python3 pipeline.py
    ```
    This will scrape the data, process it, and create the `wildflowers_data.json` file.

2.  **Run the background worker (optional):**
    To keep the data up-to-date automatically, you can run the background worker in a separate terminal:
    ```bash
    python3 background_worker.py
    ```

3.  **Run the Flask application:**
    ```bash
    python3 flask_app.py
    ```
    The application will be available at `http://127.0.0.1:5000`.
