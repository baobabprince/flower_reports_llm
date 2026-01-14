import unittest
from datetime import date, timedelta
from date_utils import parse_date, is_date_in_range


class TestDateUtils(unittest.TestCase):

    def test_parse_various_formats(self):
        self.assertEqual(parse_date('01/02/2023'), date(2023, 2, 1))
        self.assertEqual(parse_date('1/2/2023'), date(2023, 2, 1))
        self.assertEqual(parse_date('2023-02-01'), date(2023, 2, 1))
        self.assertEqual(parse_date('2023-02-01T12:00:00'), date(2023, 2, 1))
        self.assertEqual(parse_date('on 01/02/2023 some text'), date(2023, 2, 1))
        self.assertIsNone(parse_date('not a date'))
        self.assertIsNone(parse_date('31/02/2023'))  # invalid day

    def test_is_date_in_range_all(self):
        self.assertTrue(is_date_in_range('01/01/2023', None, None))

    def test_is_date_in_range_bounds(self):
        today = date.today()
        seven_days_ago = today - timedelta(days=7)
        self.assertTrue(is_date_in_range(today.strftime('%d/%m/%Y'), seven_days_ago, today))
        self.assertFalse(is_date_in_range((today - timedelta(days=8)).strftime('%d/%m/%Y'), seven_days_ago, today))

    def test_edge_cases(self):
        self.assertFalse(is_date_in_range('', date(2020,1,1), date(2020,12,31)))
        self.assertFalse(is_date_in_range(None, date(2020,1,1), date(2020,12,31)))


if __name__ == '__main__':
    unittest.main()
