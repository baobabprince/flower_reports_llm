import json

def main():
    """Generates a static index.html file with embedded wildflower data."""
    try:
        with open('wildflowers_data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        data = []

    with open('index.template.html', 'r', encoding='utf-8') as f:
        template = f.read()

    # Inject the JSON data into the template
    # The placeholder `##DATA##` will be replaced by the actual data.
    html_content = template.replace('\'##DATA##\'', json.dumps(data))

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)

    print("Successfully generated index.html")

if __name__ == '__main__':
    main()
