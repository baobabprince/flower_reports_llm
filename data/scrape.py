import requests
from bs4 import BeautifulSoup
import time
import os
from urllib.parse import urljoin

def scrape_wildflowers(start_page=1, end_page=700, output_folder="data"):
    """
    Scrapes data from wildflowers.co.il and saves it to local files.

    Args:
        start_page: The starting page number.
        end_page: The ending page number.
        output_folder: The folder to save the scraped data.
    """
    if not os.path.exists(output_folder):
      os.makedirs(output_folder)

    base_url = "https://www.wildflowers.co.il/hebrew/flash.asp"

    for page_num in range(start_page, end_page + 1):
        params = {"page": page_num} # correct parameter name
        print(f"Scraping page {page_num}...")

        try:
          response = requests.get(base_url, params=params) # send the request with the page number
          response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

          soup = BeautifulSoup(response.content, "html.parser")
          about_body_div = soup.find("div", class_="aboutBody")# locate the div

          if about_body_div: # if the div exist
            filename = os.path.join(output_folder, f"page_{page_num}.txt")
            with open(filename, "w", encoding="utf-8") as file:
              file.write(about_body_div.get_text(separator="\n", strip=True))
            print(f"  Saved data to {filename}")
          else:
             print("    No 'aboutBody' div found on this page.")

        except requests.exceptions.RequestException as e:
           print(f"  Error scraping page {page_num}: {e}")

        time.sleep(1)  # Wait 1 second between requests


if __name__ == "__main__":
   scrape_wildflowers(start_page=1, end_page=700)
   print("Scraping completed!")