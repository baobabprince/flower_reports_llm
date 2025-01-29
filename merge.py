import json
import os

def merge_json_files(folder_path, output_file):
    """
    Merges all JSON files in a folder into a single JSON file.
    Adds the original filename to each report.
    Removes first and last line from each file and adds commas between reports.

    Args:
        folder_path (str): The path to the folder containing JSON files.
        output_file (str): The path to the output JSON file.
    """
    all_reports = []
    for filename in os.listdir(folder_path):
        if filename.endswith(".json"):
            file_path = os.path.join(folder_path, filename)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                if len(lines) > 2:  # Ensure there are at least 3 lines to remove first and last
                    lines = lines[1:-1]  # Remove first and last line
                    file_content = "".join(lines)
                elif len(lines) == 2:
                    file_content=""
                elif len(lines) == 1:
                     file_content =""
                else:
                  print(f"Warning: File {filename} is empty.")
                  continue

                if not file_content.strip():  # Check if file is empty after removing lines
                    print(f"Warning: File {filename} is empty after removing first and last lines.")
                    continue

                data = json.loads(file_content)
                if 'reports' in data:
                    for report in data['reports']:
                        report['source_file'] = f"wildflowers/{filename}" # i change it after it manually to the actual link
                        all_reports.append(report)
                else:
                    print(f"Warning: No 'reports' key found in file: {filename}")

            except json.JSONDecodeError as e:
                print(f"Error decoding JSON in file: {filename}: {e}")
            except Exception as e:
                print(f"Error processing file: {filename}: {e}")

    with open(output_file, 'w', encoding='utf-8') as outfile:
        outfile.write('{\n  "reports": [\n')
        for i, report in enumerate(all_reports):
            json.dump(report, outfile, indent=2, ensure_ascii=False)
            if i < len(all_reports) - 1:
                outfile.write(',\n')
            else:
                outfile.write('\n')
        outfile.write('  ]\n}')


if __name__ == "__main__":
    folder_path = "output"  # Replace with the path to your folder
    output_file = "merged_reports.json"  # Replace with your desired output file path
    merge_json_files(folder_path, output_file)
    print(f"Merged JSON files into {output_file}")