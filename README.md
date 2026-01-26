# Flower Reports LLM

This project scrapes and parses flowering report data from various websites, processes it using a Large Language Model (LLM), and displays the results on an interactive map.

**Live Site:** [https://baobabprince.github.io/flower_reports_llm/](https://baobabprince.github.io/flower_reports_llm/)

## Project Structure

- **`pipeline.py`**: The main data processing pipeline. This script scrapes data from `wildflowers.co.il`, processes local HTML files from the `tiuli_scraped_reports` directory, extracts flower and location information using the Gemini API, and geocodes the locations using the LocationIQ API. The processed data is saved to `wildflowers_data.json`.
- **`build_static.py`**: A script that generates the static `index.html` file by injecting the data from `wildflowers_data.json` into a template.
- **`tests/`**: Contains the unit tests for the data pipeline.
- **`.github/workflows/scrape.yml`**: A GitHub Action that runs the scraping pipeline daily.
- **`.github/workflows/deploy.yml`**: A GitHub Action that builds and deploys the static site to GitHub Pages.
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

## Running Locally

1.  **Run the data processing pipeline:**
    To perform an initial run of the data processing pipeline, execute the following command:
    ```bash
    python3 pipeline.py
    ```
    This will scrape the data, process it, and create the `wildflowers_data.json` file.

2.  **Build the static site:**
    ```bash
    python3 build_static.py
    ```
    This will generate the `index.html` file.

3.  **View the site:**
    Open the `index.html` file in your web browser to see the map.

## Testing

To run the unit tests, execute the following command:
```bash
python3 -m unittest discover tests
```

## Automated Workflows

This project uses GitHub Actions to automate data scraping and deployment.

### Automated Scraping

The workflow defined in `.github/workflows/scrape.yml` runs daily to keep the flower data fresh.

### Automated Deployment to GitHub Pages

The workflow defined in `.github/workflows/deploy.yml` automatically builds and deploys the site to GitHub Pages whenever changes are pushed to the `main` branch.

To enable this, you need to:

1.  **Add repository secrets:**
    -   `GEMINI_API_KEY`: Your API key for the Gemini API.
    -   `LOCATIONIQ_API_KEY`: Your API key for the LocationIQ API.

2.  **Enable GitHub Pages:**
    -   Go to your repository's **Settings** tab.
    -   In the "Code and automation" section, click on **Pages**.
    -   Under "Build and deployment", select **GitHub Actions** as the source.
