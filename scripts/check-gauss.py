"""Exercise both Gauss tabs and capture the catalog miniature.
Run against an Astro dev/preview server: python scripts/check-gauss.py --base-url http://127.0.0.1:4326
Requires Python Playwright; miniature encoding uses the repository's sharp dependency.
"""
import argparse
from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:4326')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
shots = root / '.tmp' / 'gauss'
shots.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1312, 'height': 788}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.goto(args.base_url.rstrip('/') + '/tools/gauss-distribution/')
    app = page.locator('#gauss-panel-distribution')
    expect(app.get_by_test_id('probability')).to_have_text('0.409877', timeout=90000)
    page.evaluate("document.documentElement.dataset.theme = 'light'")
    page.evaluate('document.fonts.ready')
    page.add_style_tag(content='astro-dev-toolbar { display: none !important; } html { scroll-behavior: auto !important; }')
    expect(page.locator('.gauss-math .katex')).to_have_count(9, timeout=15000)
    assert page.locator('.katex-error').count() == 0
    app.locator('.cee-tool').evaluate('el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 76)')
    page.wait_for_timeout(500)  # Let the site's sticky navigation settle before the capture.
    page.screenshot(path=str(shots / 'miniature.png'), animations='disabled')

    app.get_by_label('Desired output').select_option('left')
    expect(app.get_by_test_id('probability')).to_have_text('0.909877')
    app.get_by_label('Standard deviate, z', exact=True).fill('-1.34')
    expect(app.get_by_test_id('probability')).to_have_text('0.090123')
    app.get_by_label('Desired output').select_option('right')
    expect(app.get_by_test_id('probability')).to_have_text('0.909877')
    app.get_by_label('Desired output').select_option('central')
    expect(app.get_by_test_id('probability')).to_have_text('0.819755')
    app.get_by_role('button', name='z 1.96, area 0.475002', exact=True).click()
    expect(app.get_by_label('Standard deviate, z', exact=True)).to_have_value('-1.96')
    app.get_by_label('Standard deviate, z', exact=True).fill('')
    expect(app.get_by_test_id('probability')).to_have_text('—')
    expect(app.get_by_role('alert')).to_be_visible()
    app.get_by_role('button', name='Load example').click()
    expect(app.get_by_test_id('probability')).to_have_text('0.089856')
    app.get_by_label('Enter the cutoff as').select_option('z')
    expect(app.get_by_test_id('probability')).to_have_text('0.089856')
    app.get_by_role('button', name='Standard normal', exact=True).click()
    app.get_by_label('Standard deviation, σ', exact=True).fill('2')
    app.get_by_label('Standard deviation of Y, σY', exact=True).fill('3')
    app.get_by_label('Correlation, ρ', exact=True).fill('-0.5')
    expect(app.get_by_test_id('covariance')).to_have_text('-3')
    app.get_by_label('Correlation, ρ', exact=True).fill('2')
    expect(app.get_by_test_id('covariance')).to_have_text('—')
    app.get_by_role('button', name='Standard normal', exact=True).click()

    page.get_by_role('tab', name='Reliability deviates').click()
    rel = page.locator('#gauss-panel-reliability')
    expect(rel.get_by_test_id('reliability-deviate')).to_have_text('-1.644854')
    rel.get_by_role('button', name='99.99%', exact=True).click()
    expect(rel.get_by_test_id('reliability-deviate')).to_have_text('-3.719016')
    rel.get_by_label('Value source').select_option('printed')
    expect(rel.get_by_test_id('reliability-deviate')).to_have_text('-3.750')
    rel.get_by_role('button', name='Select 95% reliability', exact=True).click()
    expect(rel.get_by_test_id('reliability-deviate')).to_have_text('-1.645')
    rel.get_by_label('Value source').select_option('computed')
    rel.get_by_label('Reliability, R (%)', exact=True).fill('100')
    expect(rel.get_by_test_id('reliability-deviate')).to_have_text('—')
    rel.get_by_role('button', name='95%', exact=True).click()
    page.get_by_role('tab', name='Reliability deviates').focus()
    page.keyboard.press('ArrowLeft')
    expect(page.get_by_role('tab', name='Gauss distribution')).to_have_attribute('aria-selected', 'true')

    for theme in ('light', 'dark'):
        page.evaluate('(t) => document.documentElement.dataset.theme = t', theme)
        for width in (1312, 768, 390, 320):
            page.set_viewport_size({'width': width, 'height': 850})
            for tab in ('Gauss distribution', 'Reliability deviates'):
                page.get_by_role('tab', name=tab).click()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (theme, width, tab, 'page overflow')
                page.locator('.gauss-tabs').evaluate('el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 76)')
                page.screenshot(path=str(shots / f'{theme}-{width}-{tab.split()[0]}.png'), animations='disabled')
                if width == 390:
                    panel = page.locator('[role="tabpanel"]:visible')
                    panel.locator('.gauss-main > section').first.screenshot(path=str(shots / f'{theme}-390-{tab.split()[0]}-chart.png'), animations='disabled')
    assert not errors, errors
    browser.close()

subprocess.run(['node', '--input-type=module', '-e',
    "import sharp from 'sharp'; await sharp('.tmp/gauss/miniature.png').webp({quality:82}).toFile('public/tools/gauss-distribution.webp');"],
    cwd=root, check=True)
print('PASS: output modes, table selection, invalid inputs, example, covariance, reliability sources, keyboard tabs, KaTeX, both themes and four widths. Miniature saved.')
