"""Create the GRLS CRY tee checkout in Stripe: one product + price + payment link per size.

    python3 tools/stripe_setup.py test      # or: live

Reads STRIPE_{TEST,LIVE}_RESTRICTED_KEY from ~/.config/grlscry/credentials-local.json
(restricted key, Write on Products, Prices, Payment Links, Shipping Rates) and never
prints it. Safe to re-run: products, prices, the shipping rate and payment links are
found again by their grlscry_sku metadata / lookup_key instead of being duplicated.
Writes the size -> payment-link URL map to tools/stripe-links-<mode>.json.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

MODE = sys.argv[1] if len(sys.argv) > 1 else ''
if MODE not in ('test', 'live'):
    sys.exit('usage: stripe_setup.py test|live')

CREDS = os.path.expanduser('~/.config/grlscry/credentials-local.json')
KEY = json.load(open(CREDS)).get(f'STRIPE_{MODE.upper()}_RESTRICTED_KEY', '').strip()
if not KEY.startswith(f'rk_{MODE}_'):
    sys.exit(f'STRIPE_{MODE.upper()}_RESTRICTED_KEY missing or not an rk_{MODE}_ key')

content = json.load(open('content.json'))['shop']['product']
SIZES = content['sizes']
PRICE_CENTS = int(round(float(content['price']) * 100))
SHIP_CENTS = int(round(float(content['shipping']) * 100))
NAME = 'GRLS CRY Boxy Tee'
SHIP_NAME = 'Made to order'  # Stripe appends the delivery estimate itself
THANKS = ("Thank you. Your GRLS CRY tee is made to order and ships in 2–3 weeks. "
          "Questions: reply to your receipt email.")


def flat(d, prefix=''):
    out = []
    for k, v in d.items():
        key = f'{prefix}[{k}]' if prefix else k
        if isinstance(v, dict):
            out += flat(v, key)
        elif isinstance(v, list):
            for i, item in enumerate(v):
                if isinstance(item, dict):
                    out += flat(item, f'{key}[{i}]')
                else:
                    out.append((f'{key}[{i}]', item))
        elif isinstance(v, bool):
            out.append((key, 'true' if v else 'false'))
        else:
            out.append((key, v))
    return out


def api(method, path, params=None):
    url = 'https://api.stripe.com/v1/' + path
    data = None
    if params and method == 'GET':
        url += '?' + urllib.parse.urlencode(flat(params))
    elif params:
        data = urllib.parse.urlencode(flat(params)).encode()
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={'Authorization': 'Bearer ' + KEY})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        err = json.load(e).get('error', {})
        sys.exit(f'{method} {path}: {e.code} {err.get("message")}')


def list_all(path, params=None):
    params = dict(params or {}, limit=100)
    while True:
        page = api('GET', path, params)
        yield from page['data']
        if not page.get('has_more'):
            return
        params['starting_after'] = page['data'][-1]['id']


# shipping rate (one, reused by every link)
ship = next((r for r in list_all('shipping_rates', {'active': True})
             if r.get('metadata', {}).get('grlscry') == 'tee-shipping'
             and r['fixed_amount']['amount'] == SHIP_CENTS), None)
if not ship:
    ship = api('POST', 'shipping_rates', {
        'display_name': SHIP_NAME, 'type': 'fixed_amount',
        'fixed_amount': {'amount': SHIP_CENTS, 'currency': 'usd'},
        'delivery_estimate': {'minimum': {'unit': 'week', 'value': 2},
                              'maximum': {'unit': 'week', 'value': 3}},
        'metadata': {'grlscry': 'tee-shipping'}})
print('shipping rate', ship['id'], f"${SHIP_CENTS / 100:.2f}")

products = {p['metadata'].get('grlscry_sku'): p
            for p in list_all('products', {'active': True}) if p.get('metadata', {}).get('grlscry_sku')}
links_by_sku = {l['metadata'].get('grlscry_sku'): l
                for l in list_all('payment_links', {'active': True}) if l.get('metadata', {}).get('grlscry_sku')}

out = {}
for size in SIZES:
    sku = 'TEE-' + ''.join(ch for ch in size if ch.isalnum())
    prod = products.get(sku) or api('POST', 'products', {
        'name': f'{NAME} — {size}',
        'description': content.get('blurb', ''),
        'shippable': True,
        'metadata': {'grlscry_sku': sku, 'size': size}})

    lookup = f'grlscry-{sku.lower()}-{PRICE_CENTS}'
    found = api('GET', 'prices', {'lookup_keys': [lookup], 'active': True})['data']
    price = found[0] if found else api('POST', 'prices', {
        'product': prod['id'], 'currency': 'usd', 'unit_amount': PRICE_CENTS,
        'lookup_key': lookup, 'metadata': {'grlscry_sku': sku}})

    link = links_by_sku.get(sku)
    if not link:
        link = api('POST', 'payment_links', {
            'line_items': [{'price': price['id'], 'quantity': 1,
                            'adjustable_quantity': {'enabled': True, 'minimum': 1, 'maximum': 5}}],
            'shipping_address_collection': {'allowed_countries': ['US']},
            'shipping_options': [{'shipping_rate': ship['id']}],
            'billing_address_collection': 'auto',
            'after_completion': {'type': 'hosted_confirmation',
                                 'hosted_confirmation': {'custom_message': THANKS}},
            'metadata': {'grlscry_sku': sku, 'size': size}})
    out[size] = link['url']
    print(f'{size:>4}  {sku:<8} {prod["id"]}  {price["id"]}  {link["url"]}')

path = f'tools/stripe-links-{MODE}.json'
json.dump(out, open(path, 'w'), indent=2)
print('wrote', path)
