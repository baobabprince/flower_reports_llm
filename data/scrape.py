import requests
from bs4 import BeautifulSoup
import time
import os
from urllib.parse import urljoin
def scrape_wildflowers(start_page=1, end_page=778, output_folder="data"):
    """
    Scrapes data from wildflowers.co.il, including HTML tags, and saves it to local files.

    Args:
        start_page: The starting page number.
        end_page: The ending page number.
        output_folder: The folder to save the scraped data.
    """
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    base_url = "https://www.wildflowers.co.il/hebrew/flash.asp"

    for page_num in range(start_page, end_page + 1):
        params = {"page": page_num}
        print(f"Scraping page {page_num}...")

        try:
            response = requests.get(base_url, params=params)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, "html.parser")
            about_body_div = soup.find("div", class_="aboutBody")

            if about_body_div:
                filename = os.path.join(output_folder, f"page_{page_num}.html") # changed extension to .html
                with open(filename, "w", encoding="utf-8") as file:
                    file.write(str(about_body_div))   # Write the HTML string
                print(f"  Saved HTML data to {filename}")
            else:
                print("    No 'aboutBody' div found on this page.")

        except requests.exceptions.RequestException as e:
            print(f"  Error scraping page {page_num}: {e}")

        time.sleep(1)

if __name__ == "__main__":
   scrape_wildflowers(start_page=1, end_page=778)
   print("Scraping completed!")