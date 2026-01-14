from datetime import datetime, date
import re
from typing import Optional


def parse_date(s: Optional[str]) -> Optional[date]:
    """Parse various date formats into a date object.

    Accepts:
    - DD/MM/YYYY or D/M/YYYY
    - YYYY-MM-DD
    - ISO-8601 date strings
    - Fallback: finds a date-like substring and parses it
    Returns a datetime.date or None on failure.
    """
    if not s or not isinstance(s, str):
        return None

    s = s.strip()

    # DD/MM/YYYY or D/M/YYYY
    m = re.match(r"^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$", s)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if year < 100:  # two-digit year
            year += 2000
        try:
            return datetime(year, month, day).date()
        except ValueError:
            return None

    # YYYY-MM-DD
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
    if m:
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return datetime(year, month, day).date()
        except ValueError:
            return None

    # ISO parse attempt
    try:
        dt = datetime.fromisoformat(s)
        return dt.date()
    except Exception:
        pass

    # Fallback: extract common date-like substrings
    m = re.search(r"(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})|(\d{4}-\d{2}-\d{2})", s)
    if m:
        return parse_date(m.group(0))

    return None


def is_date_in_range(s: Optional[str], range_from: Optional[date], range_to: Optional[date]) -> bool:
    """Return True if the date string s falls within [range_from, range_to].

    If both range_from and range_to are None, returns True.
    Missing or unparsable date returns False.
    """
    if range_from is None and range_to is None:
        return True
    dt = parse_date(s)
    if not dt:
        return False
    if range_from and dt < range_from:
        return False
    if range_to and dt > range_to:
        return False
    return True
