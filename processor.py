import os
import logging
import google.generativeai as genai

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('processing.log'),
        logging.StreamHandler()
    ]
)

class FlowerReportProcessor:
    def __init__(self, api_key: str, prompt_path: str):
        """
        Initialize the FlowerReportProcessor.

        Args:
            api_key (str): The Google Generative AI API key to use.
            prompt_path (str): The path to the file containing the prompt template to use.
        """
        self.api_key = api_key
        self.prompt_path = prompt_path
        self.prompt_template = self._load_prompt()
        genai.configure(api_key=self.api_key)

        generation_config = {
            "temperature": 1,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
        }
        self.model = genai.GenerativeModel(
            model_name="gemini-2.0-flash-exp",
            generation_config=generation_config,
        )

    def _load_prompt(self) -> str:
        try:
            with open(self.prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            logging.error(f"Failed to load prompt: {str(e)}")
            raise

    def _call_gemini_api(self, text: str) -> str:
        full_prompt = f"{self.prompt_template}\n\nInput Text:\n{text}"
        try:
            response = self.model.generate_content(full_prompt)
            return response.text
        except Exception as e:
            logging.error(f"API call failed: {str(e)}")
            return None

    def process_file(self, html_content: str, filename: str) -> None:
        """
        Processes an HTML content file by sending it to the Gemini API and saving the response.
        This function takes HTML content and a filename, calls the Gemini API to process the content,
        and saves the resulting response as a JSON file in the output directory. If the API call fails
        or no response is received, appropriate logging messages are generated.
        Args:
            html_content (str): The HTML content to be processed.
            filename (str): The name of the file being processed, used to generate the output filename.
        Returns:
            None
        """
        print(">>> Processing file:", filename)
        raw_response_text = self._call_gemini_api(html_content)
        if raw_response_text:
            output_filename = filename.replace('.html', '.json')
            output_path = os.path.join("output", output_filename)  # Simplified output path
            
            try:
                with open(output_path, 'w', encoding='utf-8') as outfile:
                    outfile.write(raw_response_text)  # Save raw text
                logging.info(f"Saved raw response to {output_path}")
            except Exception as e:
                logging.error(f"Error saving raw response for {filename}: {e}")
        else:
           logging.warning(f"No response for {filename}")

def main():
    """
    Main function to process HTML files using the FlowerReportProcessor.

    This function loads the API key from a file, initializes the FlowerReportProcessor
    with a prompt template, and processes each HTML file in the specified data directory.
    The processed responses are saved as JSON files in the output directory. If any error
    occurs during processing, it is logged.

    Raises:
        FileNotFoundError: If the API key file is not found.
        Exception: If there is a critical error processing a file.
    """

    API_KEY_FILE = "GEMINI_API_KEY"
    DATA_DIR = "data"
    OUTPUT_DIR = "output" # Simplified Output
    PROMPT_PATH = "prompt.txt"

    # Load API key
    try:
        with open(API_KEY_FILE, "r") as f:
            api_key = f.read().strip()
    except FileNotFoundError:
        logging.error(f"API key file {API_KEY_FILE} not found")
        return

    # Initialize processor
    processor = FlowerReportProcessor(api_key, PROMPT_PATH)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Process files
    for filename in os.listdir(DATA_DIR):
        if filename.endswith(".html"):
            file_path = os.path.join(DATA_DIR, filename)
            logging.info(f"Processing {filename}...")

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                processor.process_file(content, filename)
            except Exception as e:
                 logging.error(f"Critical error processing {filename}: {str(e)}")

if __name__ == "__main__":
    main()