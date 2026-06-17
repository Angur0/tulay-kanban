"""
Backend Gantt chart image generation service.

Replaces the legacy client-side html2canvas export with a server-rendered,
compressed, readable PNG/PDF pipeline using Playwright and Pillow.
"""

import datetime
import io
import os
import tempfile
from pathlib import Path
from typing import List, Optional, Tuple

from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image

# Playwright is imported lazily to avoid hard dependency at module load time

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
TEMPLATE_DIR = PROJECT_ROOT / "backend" / "templates"
UPLOAD_DIR = PROJECT_ROOT / "uploads"

def _get_jinja_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def _format_date(dt: datetime.date) -> str:
    """Standard date format for labels."""
    return dt.strftime("%b %d")


def _build_date_cells(
    min_date: datetime.date,
    max_date: datetime.date,
    px_per_day: float,
    granularity: str,
) -> List[dict]:
    """
    Generate date header cells based on granularity.
    Returns list of dicts with keys: label, width, is_today.
    """
    cells = []
    today = datetime.date.today()
    delta = (max_date - min_date).days + 1
    if delta < 1:
        delta = 1

    if granularity == "day":
        current = min_date
        while current <= max_date:
            cells.append(
                {
                    "label": current.strftime("%d"),
                    "width": px_per_day,
                    "is_today": current == today,
                }
            )
            current += datetime.timedelta(days=1)
    elif granularity == "week":
        current = min_date
        while current <= max_date:
            end_of_week = current + datetime.timedelta(days=6)
            if end_of_week > max_date:
                end_of_week = max_date
            days = (end_of_week - current).days + 1
            cells.append(
                {
                    "label": current.strftime("%b %d"),
                    "width": px_per_day * days,
                    "is_today": current <= today <= end_of_week,
                }
            )
            current = end_of_week + datetime.timedelta(days=1)
    else:  # month
        current = min_date.replace(day=1)
        while current <= max_date:
            if current.month == 12:
                next_month = current.replace(year=current.year + 1, month=1)
            else:
                next_month = current.replace(month=current.month + 1)
            end_of_month = next_month - datetime.timedelta(days=1)
            if end_of_month > max_date:
                end_of_month = max_date
            if end_of_month < current:
                end_of_month = current
            days = (end_of_month - current).days + 1
            cells.append(
                {
                    "label": current.strftime("%b %Y"),
                    "width": px_per_day * days,
                    "is_today": current <= today <= end_of_month,
                }
            )
            current = next_month

    return cells


def _compute_layout(tasks_data: List[dict]) -> dict:
    """
    Compute the visual layout parameters for the Gantt chart.
    Returns a dict with sizing and positioning info.
    """
    return {
        "row_height": 20,
        "bar_height": 14,
        "name_col_width": 180,
        "px_per_day": 28,
        "date_font_size": 8,
        "task_font_size": 10,
        "bar_label_font_size": 8,
    }


def generate_gantt_html(
    tasks: List[dict],
    board_name: str = "Board",
    dark_mode: bool = False,
    view_mode: str = "Week",
) -> str:
    """
    Generate a condensed HTML string representing the Gantt chart.

    Args:
        tasks: List of task dicts with keys:
            - id
            - name
            - start_date (datetime.date or None)
            - due_date (datetime.date or None)
            - has_dates (bool)
        board_name: Name of the board for the title.
        dark_mode: Whether to use dark theme colors.

    Returns:
        HTML string ready to be rendered by Playwright.
    """
    if not tasks:
        return ""

    layout = _compute_layout(tasks)
    row_height = layout["row_height"]
    bar_height = layout["bar_height"]
    name_col_width = layout["name_col_width"]
    px_per_day = layout["px_per_day"]

    # Determine date range
    all_dates = []
    for t in tasks:
        if t.get("start_date"):
            all_dates.append(t["start_date"])
        if t.get("due_date"):
            all_dates.append(t["due_date"])

    if all_dates:
        min_date = min(all_dates)
        max_date = max(all_dates)
    else:
        today = datetime.date.today()
        min_date = today
        max_date = today + datetime.timedelta(days=7)

    # Use exact date range from tasks without artificial padding
    if (max_date - min_date).days < 1:
        max_date = min_date + datetime.timedelta(days=1)

    # Choose granularity based on user's selected view mode
    is_many_tasks = len(tasks) > 15
    _MODE_MAP = {"Day": "day", "Week": "week", "Month": "month"}
    granularity = _MODE_MAP.get(view_mode, "week")

    if granularity == "day":
        px_per_day = 20 if is_many_tasks else 28
    elif granularity == "week":
        px_per_day = 10 if is_many_tasks else 14
    else:  # month
        px_per_day = 3 if is_many_tasks else 5

    # Build date cells
    date_cells = _build_date_cells(min_date, max_date, px_per_day, granularity)
    chart_width = sum(c["width"] for c in date_cells)

    # Compute bar positions
    total_days = (max_date - min_date).days + 1
    total_days = max(total_days, 1)

    task_entries = []
    for t in tasks:
        has_dates = t.get("has_dates", False)
        start = t.get("start_date")
        end = t.get("due_date")

        if start and end:
            start_offset = (start - min_date).days
            end_offset = (end - min_date).days
            bar_left = start_offset * px_per_day
            bar_width = max((end_offset - start_offset + 1) * px_per_day, px_per_day)
        elif start:
            start_offset = (start - min_date).days
            bar_left = start_offset * px_per_day
            bar_width = px_per_day
        elif end:
            end_offset = (end - min_date).days
            bar_left = max(end_offset * px_per_day - px_per_day, 0)
            bar_width = px_per_day
        else:
            bar_left = 0
            bar_width = 0

        # Determine label placement
        show_label_inside = False
        show_label_outside = False
        if bar_width > name_col_width * 0.5:
            show_label_inside = True
        else:
            show_label_outside = True

        task_entries.append(
            {
                "id": t["id"],
                "name": t["name"][:35] + "..." if len(t["name"]) > 35 else t["name"],
                "has_dates": has_dates,
                "bar_left": bar_left,
                "bar_width": bar_width,
                "show_label_inside": show_label_inside,
                "show_label_outside": show_label_outside,
            }
        )

    # Theme colors
    if dark_mode:
        bg_color = "#151e29"
        text_color = "#e2e8f0"
        grid_color = "#2a3a4a"
        bar_color = "#3b82f6"
        unscheduled_color = "#64748b"
        date_color = "#94a3b8"
        today_color = "#3b82f6"
    else:
        bg_color = "#fbfcfd"
        text_color = "#111418"
        grid_color = "#e5e7eb"
        bar_color = "#2b8cee"
        unscheduled_color = "#94a3b8"
        date_color = "#5c6b7f"
        today_color = "#2b8cee"

    env = _get_jinja_env()
    template = env.get_template("gantt_image.html")

    html = template.render(
        board_name=board_name,
        view_mode_label=view_mode,
        num_tasks=len(tasks),
        tasks=task_entries,
        row_height=row_height,
        bar_height=bar_height,
        name_col_width=name_col_width,
        chart_width=chart_width,
        date_cells=date_cells,
        date_font_size=layout["date_font_size"],
        task_font_size=layout["task_font_size"],
        bar_label_font_size=layout["bar_label_font_size"],
        bg_color=bg_color,
        text_color=text_color,
        grid_color=grid_color,
        bar_color=bar_color,
        unscheduled_color=unscheduled_color,
        date_color=date_color,
        today_color=today_color,
    )

    return html


async def render_html_to_image(
    html_content: str,
    output_path: Path,
    format: str = "png",
    max_width: int = 8000,
    max_height: int = 24000,
) -> Path:
    """
    Render an HTML string to an image or PDF using Playwright.

    Args:
        html_content: The HTML string to render.
        output_path: Where to save the resulting file.
        format: 'png' or 'pdf'.
        max_width: Maximum width in pixels before downscaling.
        max_height: Maximum height in pixels before downscaling.

    Returns:
        Path to the saved file.
    """
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(device_scale_factor=2)

        # Set HTML content directly
        await page.set_content(html_content, wait_until="networkidle")

        # Wait a moment for fonts/styles to settle
        await page.wait_for_timeout(500)

        if format == "pdf":
            # Calculate dimensions from the page content
            dimensions = await page.evaluate(
                """() => {
                    const el = document.querySelector('.chart-wrapper');
                    return el ? { width: el.scrollWidth, height: el.scrollHeight } : { width: 1200, height: 800 };
                }"""
            )
            page_width_px = dimensions["width"]
            page_height_px = dimensions["height"]

            await page.pdf(
                path=str(output_path),
                print_background=True,
                width=f"{page_width_px}px",
                height=f"{page_height_px}px",
            )
        else:
            # Take screenshot
            screenshot = await page.screenshot(full_page=True, type="png")
            await browser.close()

            # Compress with Pillow
            img = Image.open(io.BytesIO(screenshot))

            # Downscale if necessary
            if img.width > max_width or img.height > max_height:
                scale = min(max_width / img.width, max_height / img.height)
                new_size = (int(img.width * scale), int(img.height * scale))
                img = img.resize(new_size, Image.LANCZOS)

            # Optimize PNG
            img.save(output_path, "PNG", optimize=True)
            return output_path

        await browser.close()
    return output_path


def generate_export_filename(board_id: str, format: str) -> str:
    """Generate a unique filename for the export."""
    timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    ext = format.lower()
    return f"gantt_{board_id}_{timestamp}.{ext}"
