import unittest
from unittest.mock import patch, MagicMock
import os
import json
from pipeline import process_tiuli_files, save_data, scrape_wildflowers_page

class TestPipeline(unittest.TestCase):

    def setUp(self):
        # Create a mock session object
        self.mock_session = MagicMock()

        # Create a mock geocache
        self.mock_geocache = {}

        # Create a temporary directory for test files
        self.test_dir = 'test_data'
        os.makedirs(self.test_dir, exist_ok=True)

        # Create a dummy HTML file for testing
        self.html_file_path = os.path.join(self.test_dir, 'test.html')
        with open(self.html_file_path, 'w', encoding='utf-8') as f:
            f.write("""
            <article class="shadow-card">
                <div class="user-details">
                    <span class="text-grey-900">Test Observer</span>
                    <span class="text-grey-700">01/01/2024</span>
                </div>
                <div class="report-details">
                    <div class="mt-1">Test report content.</div>
                    <h2 class="m-0 font-bold text-lg lg:text-2xl"><a>Test Flower</a></h2>
                    <span>מיקום: Test Location</span>
                </div>
            </article>
            """)

    def tearDown(self):
        # Clean up the test files and directory
        os.remove(self.html_file_path)
        os.rmdir(self.test_dir)

    @patch('pipeline.get_coordinates')
    def test_process_tiuli_files(self, mock_get_coordinates):
        # Mock the get_coordinates function to return empty coordinates
        mock_get_coordinates.return_value = []

        # Run the process_tiuli_files function
        new_reports = process_tiuli_files([], self.mock_geocache, self.mock_session, html_dir=self.test_dir)

        # Check that the function returns the expected number of reports
        self.assertEqual(len(new_reports), 1)

        # Check that the report has the expected data
        report = new_reports[0]
        self.assertEqual(report['title'], 'Test Flower')
        self.assertEqual(report['description'], ['Test report content.'])
        self.assertEqual(report['locations'], ['Test Location'])
        self.assertEqual(report['flowers'], ['Test Flower'])
        self.assertEqual(report['observer'], 'Test Observer')
        self.assertEqual(report['date'], '01/01/2024')
        self.assertEqual(report['original_text'], 'Test report content.')

    @patch('pipeline.get_coordinates')
    def test_process_tiuli_files_skips_existing(self, mock_get_coordinates):
        # Mock the get_coordinates function to return empty coordinates
        mock_get_coordinates.return_value = []

        # Create existing data with the same report
        existing_data = [{
            'source_file': os.path.join(self.test_dir, 'test.html'),
            'original_text': 'Test report content.'
        }]

        # Run the process_tiuli_files function
        new_reports = process_tiuli_files(existing_data, self.mock_geocache, self.mock_session, html_dir=self.test_dir)

        # Check that the function returns 0 new reports
        self.assertEqual(len(new_reports), 0)

    def test_save_data(self):
        # Create some test data
        test_data = [{'title': 'Test Flower', 'description': ['Test report content.']}]

        # Save the data to a temporary file
        test_file_path = os.path.join(self.test_dir, 'test_data.json')
        save_data(test_data, filepath=test_file_path)

        # Check that the file was created
        self.assertTrue(os.path.exists(test_file_path))

        # Check that the file contains the expected data
        with open(test_file_path, 'r', encoding='utf-8') as f:
            saved_data = json.load(f)
        self.assertEqual(saved_data, test_data)

        # Clean up the test file
        os.remove(test_file_path)

    @patch('pipeline.init_requests_session')
    def test_scrape_wildflowers_page(self, mock_init_session):
        # Mock the session's get method to return a dummy HTML response
        mock_response = MagicMock()
        mock_response.text = """
        <div class="aboutBody">
            <b>Test Title</b><br>
            תאריך: 01/01/2024<br>
            Some description text.
            <a href="mailto:test@example.com">Test Reporter</a>
        </div>
        """
        mock_response.raise_for_status = MagicMock()
        self.mock_session.get.return_value = mock_response
        mock_init_session.return_value = self.mock_session

        # Run the scrape_wildflowers_page function
        reports = scrape_wildflowers_page(1, self.mock_session)

        # Check that the function returns the expected number of reports
        self.assertEqual(len(reports), 1)

        # Check that the report has the expected data
        report = reports[0]
        self.assertEqual(report['title'], 'Test Title')
        self.assertEqual(report['date'], '01/01/2024')
        self.assertEqual(report['reporter'], 'Test Reporter')
        self.assertEqual(report['description'], ['Some description text.'])

if __name__ == '__main__':
    unittest.main()
