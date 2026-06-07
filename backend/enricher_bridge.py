"""Bridge to the sibling `organizer-enricher` tool.

The tool lives outside this package (../../toolings/organizer-enricher) and imports
its own modules flat (`from adapters.x import ...`, `from schema import ...`), so we
put its directory on sys.path and import from it directly.

API keys (APOLLO/HUNTER/COMPANIES_HOUSE/FULLENRICH) come from backend/.env, the
project-root .env, or the tool's own .env; we load all three so the adapters have them.
"""

import pathlib
import sys

_TOOL_DIR = (
    pathlib.Path(__file__).parent.parent.parent / "toolings" / "organizer-enricher"
)

if str(_TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOL_DIR))

try:
    from dotenv import load_dotenv

    _here = pathlib.Path(__file__).resolve().parent
    load_dotenv(_here / ".env")  # backend/.env
    load_dotenv(_here.parent / ".env")  # project-root .env (cwd)
    load_dotenv(_TOOL_DIR / ".env")  # organizer-enricher tool .env (if present)
except ImportError:
    pass

from employee_finder import find_employees  # noqa: E402
from linkedin_people import filter_current_staff, scrape_people  # noqa: E402
from schema import EmployeeRecord  # noqa: E402

__all__ = [
    "find_employees",
    "EmployeeRecord",
    "scrape_people",
    "filter_current_staff",
]
