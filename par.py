import os
import json
import datetime
import time
import re
import google.generativeai as genai
from google.generativeai.types import GenerateContentResponse
import ast
from requests.exceptions import ReadTimeout

# Define a file to load the API KEY
API_KEY_FILE = "GEMINI_API_KEY"

def load_api_key(api_key_file="GEMINI_API_KEY"):
    """Loads the API key from the specified file."""
    try:
        with open(api_key_file, "r") as f:
            api_key = f.read().strip()
            return api_key
    except FileNotFoundError:
        print(f"Error: API key file '{api_key_file}' not found.")
        exit(1)

def process_messages(text, api_key, prompt_path):
    """Use LLM to extract flower and location information from messages using google-generativeai and returns a JSON response."""
    print("process_messages function")
    genai.configure(api_key=api_key)
    # Use the gemini-pro model
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    processed_messages = []

    # Read the prompt from the specified file
    with open(prompt_path, 'r', encoding='utf-8') as file:
        base_prompt = file.read()

    prompt = base_prompt + f"\nHere is the Hebrew text:\n{text}\n"
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print("Making API Call...")
            response = model.generate_content(prompt)
            print(f"API Response: {response.text}")
            if response and response.text:
                try:
                    llm_text = response.text
                    print(f"LLM Text Response: {llm_text}")
                    # Remove markdown code block formatting if present
                    if llm_text.startswith("```json"):
                        llm_text = llm_text[7:-4]
                    
                    # Try to parse the JSON output
                    parsed_data = json.loads(llm_text)
                    return {"response_mime_type": "application/json", "data": parsed_data}
                except json.JSONDecodeError as e:
                    print(f"JSONDecodeError: {e}. Trying ast.literal_eval...")
                    try:
                        parsed_data = ast.literal_eval(llm_text)
                        print("JSON parsed using ast.literal_eval")
                        return {"response_mime_type": "application/json", "data": parsed_data}
                    except (ValueError, SyntaxError) as e:
                        print(f"Fallback parsing failed: {e}. Retrying...")
            else:
                print("No response from LLM. Retrying...")
        except Exception as e:
            print(f"Error with API call: {e}. Retrying...")
        time.sleep(1)
    print("Failed to process with LLM after max retries.")
    return {"response_mime_type": "application/json", "data": []} # Return empty list if parsing failed

def format_messages(messages):
    """Formats the messages for final output."""
    print("format_messages function")
    formatted_messages = []
    for msg in messages:
        formatted_msg = {
            'flowers': msg.get('flower_name', None),
            'date': msg.get('date', None),
            'locations': msg.get('location_name', None),
            'maps_query_locations': msg.get('maps_query_location', None),
            'original_report': msg.get('original_message', None),
            'observer': msg.get('observer', None)
        }
        formatted_messages.append(formatted_msg)
    return formatted_messages

def main():
    """Main function to process files and generate JSON output."""
    print("main function")
    api_key = load_api_key()
    data_dir = "data"
    output_dir = "output"  # Define an output directory
    prompt_path = './prompt.txt'
    os.makedirs(output_dir, exist_ok=True)  # Create the output directory if it doesn't exist
    for filename in os.listdir(data_dir):
        if filename.startswith("page_700") and filename.endswith(".html"):
            print(f"Processing file: {filename}")
            filepath = os.path.join(data_dir, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                text = f.read()
                print("  Calling process_messages...")
                llm_response = process_messages(text, api_key, prompt_path)
                print("  Checking for errors from process_messages...")
                if llm_response and 'data' in llm_response:
                    print("  Extracting data from process_messages response...")
                    messages_with_llm = llm_response['data']
                    print("  Calling format_messages...")
                    formatted_messages = format_messages(messages_with_llm)
                else:
                    formatted_messages = []
                    print("Error: No 'data' found in LLM response.")
            output_filename = filename.replace(".html", ".json")
            output_path = os.path.join(output_dir, output_filename)  # Use the output directory
            print(f"  Saving JSON to: {output_path}")
            with open(output_path, "w", encoding="utf-8") as outfile:
                json.dump(formatted_messages, outfile, indent=4, ensure_ascii=False)
            print(f"Processed {filename} and saved to {output_filename}")
            time.sleep(1)  # Increased delay to 1 second

if __name__ == "__main__":
    main()

def format_messages(messages):
    """Formats the messages for final output."""
    print("format_messages function")
    formatted_messages = []
    for msg in messages:
        formatted_msg = {
            'flowers': msg.get('flower_name', None),
            'date': msg.get('date', None),
            'locations': msg.get('location_name', None),
             'maps_query_locations': msg.get('maps_query_location', None),
            'original_report': msg.get('original_message', None),
            'observer': msg.get('observer', None)
        }
        formatted_messages.append(formatted_msg)
    return formatted_messages

def main():
    """Main function to process files and generate JSON output."""
    print("main function")
    api_key = load_api_key()
    data_dir = "data"
    output_dir = "output"  # Define an output directory
    prompt_path = './prompt.txt'
    os.makedirs(output_dir, exist_ok=True)  # Create the output directory if it doesn't exist
    for filename in os.listdir(data_dir):
        if filename.startswith("page_700") and filename.endswith(".html"):
            print(f"Processing file: {filename}")
            filepath = os.path.join(data_dir, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                text = f.read()
                print("  Calling process_messages...")
                llm_response = process_messages(text, api_key, prompt_path)
                print("  Checking for errors from process_messages...")
                if llm_response and 'data' in llm_response:
                    print("  Extracting data from process_messages response...")
                    messages_with_llm = llm_response['data']
                    print("  Calling format_messages...")
                    formatted_messages = format_messages(messages_with_llm)
                else:
                    formatted_messages = []
                    print("Error: No 'data' found in LLM response.")
            output_filename = filename.replace(".html", ".json")
            output_path = os.path.join(output_dir, output_filename)  # Use the output directory
            print(f"  Saving JSON to: {output_path}")
            with open(output_path, "w", encoding="utf-8") as outfile:
                json.dump(formatted_messages, outfile, indent=4, ensure_ascii=False)
            print(f"Processed {filename} and saved to {output_filename}")
            time.sleep(1)  # Increased delay to 1 second

if __name__ == "__main__":
    main()