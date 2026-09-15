"""Capture tool-card miniatures from the built fitter pages.
Requires Python Playwright, Chromium, and Pillow.
"""
import argparse
from io import BytesIO
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--base-url", default="http://127.0.0.1:4326")
args = parser.parse_args()
output = Path(__file__).resolve().parents[1] / "public" / "tools"
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1312, "height": 788}, device_scale_factor=1)
    for slug in ("mr-fitter", "cbr"):
        page.goto(args.base_url.rstrip("/") + "/tools/" + slug + "/")
        page.evaluate("document.documentElement.dataset.theme = 'light'")
        page.wait_for_function("document.querySelector('.js-plotly-plot')?._fullLayout?.xaxis?.minor?.showgrid")
        page.evaluate("document.fonts.ready")
        # Keep the complete first chart in the frame beneath the fixed header.
        page.locator(".cee-tool").evaluate("el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 76)")
        page.wait_for_timeout(800)
        Image.open(BytesIO(page.screenshot(animations="disabled"))).convert("RGB").save(output / (slug + ".webp"), "WEBP", quality=90, method=6)
        print("Updated", output / (slug + ".webp"))
    browser.close()
