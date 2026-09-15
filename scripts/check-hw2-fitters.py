"""Browser regression check. Requires Python Playwright and Chromium.
Run against the dev/preview server: python scripts/check-hw2-fitters.py --base-url http://127.0.0.1:4324
"""
import argparse
import re
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:4324')
parser.add_argument('--harness', action='store_true', help='Use the isolated component harness during development')
args = parser.parse_args()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1312, 'height': 788})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    def go(slug):
        url = ('/?cbr' if slug == 'cbr' else '/') if args.harness else '/tools/' + slug + '/'
        page.goto(args.base_url.rstrip('/') + url)
        page.wait_for_function("document.querySelector('.js-plotly-plot')?.data?.length > 0")
    go('mr-fitter')
    expect(page.get_by_role('checkbox')).to_have_count(30)
    expect(page.locator('.cee-kpi')).to_have_count(0)
    expect(page.get_by_role('button', name='Fit selected model')).to_be_disabled()
    expect(page.get_by_role('button', name='Calculate prediction')).to_be_disabled()
    page.get_by_label('Model to fit').select_option('generalized')
    page.get_by_role('button', name='Fit selected model').click()
    expect(page.locator('.cee-kpi')).to_have_count(5)
    assert page.evaluate('''() => {
        const p = document.querySelector('.js-plotly-plot');
        return ['xaxis','yaxis'].every(a => p._fullLayout[a].showgrid && p._fullLayout[a].minor.showgrid)
          && p.data.filter(t => t.mode === 'lines').length === 1
          && p.data.filter(t => t.mode === 'lines').every(t => t.x.length === 401)
          && p.layout.yaxis.title.text.includes('Shear-normalized');
    }''')
    expect(page.locator('.katex-error')).to_have_count(0)
    page.get_by_role('button', name='Raw stress response', exact=True).click()
    page.wait_for_function("document.querySelector('.js-plotly-plot').data.filter(t => t.mode === 'lines').length === 3")
    page.get_by_role('button', name='Single power curve', exact=True).click()
    page.wait_for_function("document.querySelector('.js-plotly-plot').data.filter(t => t.mode === 'lines').length === 1")
    page.get_by_label('Model to fit').select_option('bulk')
    page.get_by_role('button', name='Fit selected model').click()
    expect(page.locator('.cee-kpi')).to_have_count(4)
    page.get_by_role('spinbutton', name=re.compile('^Bulk stress')).fill('1500')
    page.get_by_role('spinbutton', name=re.compile('^Deviator stress')).fill('200')
    page.get_by_role('button', name='Calculate prediction').click()
    table = page.get_by_role('table', name='Modulus predictions')
    expect(table.get_by_role('row')).to_have_count(3)
    page.wait_for_function('''() => {
        const traces = document.querySelector('.js-plotly-plot').data;
        return traces.filter(t => t.name === 'Prediction guides').length === 2
          && traces.filter(t => t.name?.endsWith(' prediction')).length === 2;
    }''')
    expect(page.get_by_text('Extrapolation:', exact=False)).to_be_visible()
    page.get_by_label('Model to fit').select_option('generalized')
    page.wait_for_function("document.querySelector('.js-plotly-plot').layout.yaxis.title.text.includes('Shear-normalized')")
    assert page.evaluate("""() => {
        const p = document.querySelector('.js-plotly-plot').data.find(t => t.name === 'Generalized model prediction');
        const expected = 1288.7674221845034 * 101.325 * (1500 / 101.325) ** .7133195435731182 / 1000;
        return Math.abs(p.y[0] - expected) < 1e-6;
    }""")
    page.get_by_role('spinbutton', name=re.compile('^Bulk stress')).fill('1200')
    page.wait_for_function("document.querySelector('.js-plotly-plot').data.find(t => t.name === 'Generalized model prediction')?.x[0] === 1200")
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(300)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'normalized view overflows on mobile'
    page.set_viewport_size({'width': 1312, 'height': 788})
    page.get_by_label('Model to fit').select_option('bulk')

    page.get_by_label('Include point 8', exact=True).uncheck()
    expect(page.locator('.cee-kpi')).to_have_count(0)
    expect(table).to_have_count(0)
    expect(page.get_by_label('Include point 9', exact=True)).to_be_checked()
    page.get_by_role('button', name='Fit selected model').click()
    expect(page.locator('.cee-kpi')).to_have_count(4)
    page.get_by_role('button', name='Add point', exact=True).click()
    expect(page.get_by_role('button', name='Fit selected model')).to_be_disabled()
    page.get_by_role('button', name='Remove point 1000', exact=True).click()
    expect(page.get_by_role('button', name='Fit selected model')).to_be_enabled()
    page.get_by_role('button', name='Load HW2 data').click()
    expect(page.get_by_role('checkbox')).to_have_count(30)
    expect(page.get_by_label('Include point 8', exact=True)).to_be_checked()
    page.get_by_text('Paste a different dataset', exact=True).click()
    page.get_by_label('Paste numeric data').fill('1,2,bad')
    page.get_by_role('button', name='Load pasted data').click()
    expect(page.get_by_role('checkbox')).to_have_count(30)
    expect(page.get_by_role('alert')).to_contain_text('Line 1')
    page.get_by_label('Paste numeric data').fill('10,20,.001\n20,40,.002\n30,50,.003')
    page.get_by_role('button', name='Load pasted data').click()
    expect(page.get_by_role('checkbox')).to_have_count(3)
    print('MR: explicit fits, both-model predictions, exclusions, editing, validation and reset passed')

    go('cbr')
    expect(page.get_by_role('spinbutton', name=re.compile('^Origin correction'))).to_have_value('0')
    expect(page.get_by_role('button', name='Calculate CBR 0.10')).to_be_disabled()
    page.get_by_label('First reading').select_option('2')
    expect(page.get_by_role('spinbutton', name=re.compile('^Origin correction'))).to_have_value('0')
    page.get_by_label('First reading').select_option('3')
    expect(page.get_by_role('button', name='Use this origin correction')).to_be_disabled()
    page.get_by_label('First reading').select_option('2')
    page.get_by_role('button', name='Use this origin correction').click()
    assert abs(float(page.get_by_role('spinbutton', name=re.compile('^Origin correction')).input_value()) - .04) < 1e-10
    page.wait_for_function('''() => {
        const p = document.querySelector('.js-plotly-plot');
        const t = p.data.find(t => t.name === 'Selected tangent');
        return t?.line.dash === 'dash' && t.x[0] === p.layout.xaxis.range[0]
          && t.x[1] === p.layout.xaxis.range[1];
    }''')
    for target, lo, hi in [('0.10','3','4'),('0.20','5','6')]:
        page.get_by_label('Lower reading for ' + target).select_option(lo)
        page.get_by_label('Upper reading for ' + target).select_option(hi)
        page.get_by_role('button', name='Calculate CBR ' + target).click()
    results = page.get_by_role('table', name='CBR results')
    expect(results).to_contain_text('7.2')
    expect(results).to_contain_text('6.53333')
    page.get_by_role('spinbutton', name=re.compile('^Origin correction')).fill('0')
    expect(results).not_to_contain_text('7.2')
    page.get_by_label('Lower reading for 0.10').select_option('1')
    page.get_by_label('Upper reading for 0.10').select_option('4')
    page.get_by_role('button', name='Calculate CBR 0.10').click()
    expect(page.get_by_role('alert')).to_contain_text('adjacent')
    page.get_by_label('Lower reading for 0.10').select_option('3')
    page.get_by_label('Upper reading for 0.10').select_option('3')
    page.get_by_role('button', name='Calculate CBR 0.10').click()
    expect(results.get_by_role('row').nth(1)).to_contain_text('60')
    page.get_by_label('Penetration (in), point 2', exact=True).fill('0')
    expect(page.get_by_role('button', name='Calculate CBR 0.10')).to_be_disabled()
    expect(results).not_to_contain_text('60')
    page.get_by_role('button', name='Load HW2 data').click()
    print('CBR: tangent choices, explicit origin, interpolation, correction reset and duplicate rejection passed')

    for slug in ['mr-fitter','cbr']:
        go(slug)
        for width in [390, 1312, 390]:
            page.set_viewport_size({'width': width, 'height': 844})
            page.wait_for_timeout(400)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'page overflows at phone width'
            assert page.locator('.js-plotly-plot').first.bounding_box()['height'] >= 300
        page.evaluate("document.documentElement.dataset.theme = 'dark'")
        page.wait_for_timeout(250)
        expect(page.locator('.katex-error')).to_have_count(0)
        page.evaluate("document.documentElement.dataset.theme = 'light'")
    assert not errors, errors
    print('Both tools: mobile resizing, dark mode and no browser errors passed')
    browser.close()
