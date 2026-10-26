"""Run against provisioned disposable TEST fixtures; never production.

Usage: python auth_api_test_only.py /path/to/private-fixtures.json
Fixture credentials stay in memory; results contain no tokens or passwords.
Database fixture cleanup must run through the privileged SQL orchestrator afterward.
"""
import concurrent.futures
import json
import sys
import urllib.error
import urllib.request

cfg = json.load(open(sys.argv[1]))
assert cfg['url'] == 'https://bsykqjiownewnzguilli.supabase.co', 'TEST-only guard'


def request(path, token=None, method='GET', data=None, representation=False):
    headers = {'apikey': cfg['key'], 'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if representation:
        headers['Prefer'] = 'return=representation'
    req = urllib.request.Request(cfg['url'] + path,
        data=None if data is None else json.dumps(data).encode(), headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            body = json.loads(raw)
        except ValueError:
            body = {'code': 'non_json_response'}
        return error.code, body


def run_user(u):
    checks = []
    token = None
    refresh = None
    def check(name, condition, status=None):
        result = {'case': u['label'], 'check': name, 'pass': bool(condition)}
        if status is not None:
            result['http'] = status
        checks.append(result)
        if not condition:
            raise AssertionError(name)
    def get(table, query=''):
        status, rows = request('/rest/v1/' + table + '?select=*' + query, token)
        check(table + '_http', status == 200 and isinstance(rows, list), status)
        return rows
    try:
        status, auth = request('/auth/v1/token?grant_type=password', method='POST',
            data={'email': u['email'], 'password': u['password']})
        check('password_login', status == 200 and bool(auth.get('access_token')), status)
        token, refresh = auth['access_token'], auth['refresh_token']
        check('session_identity', auth['user']['id'] == u['id'])
        status, identity = request('/auth/v1/user', token)
        check('server_verifies_token', status == 200 and identity.get('id') == u['id'], status)
        premium = u['plan'] != 'basic' and u['paid']
        admin = u['role'] == 'admin'
        rows = get('weekly_training_plan')
        check('premium_plan_and_isolation', len(rows) == (5 if admin else int(premium)) and
            (admin or all(r['athlete_id'] == u['id'] for r in rows)))
        rows = get('workouts')
        check('premium_workout_and_isolation', len(rows) == (5 if admin else int(premium)) and
            (admin or all(r['user_id'] == u['id'] for r in rows)))
        rows = get('training_sessions')
        check('premium_exercise_and_isolation', len(rows) == (5 if admin else int(premium)) and
            (admin or all(r['workout_id'] == u['workout'] for r in rows)))
        rows = get('club_subscription_requests')
        check('subscriptions_isolated', len(rows) == (5 if admin else 1) and
            (admin or all(r['user_id'] == u['id'] for r in rows)))
        rows = get('club_subscription_monthly_dues')
        check('dues_isolated', len(rows) == (5 if admin else 1) and
            (admin or all(r['subscription_id'] == u['subscription'] for r in rows)))
        rows = get('club_activities', '&id=eq.' + cfg['activity'])
        check('outing_requires_payment', len(rows) == int(u['paid'] or admin))
        status, body = request('/rest/v1/rpc/mark_training_completed', token, 'POST',
            {'p_id': u['weekly'], 'p_completed': True})
        check('completion_rpc_requires_premium',
            status in (200, 204) if (premium or admin) else status == 403, status)
        foreign = next(x for x in cfg['users'] if x['id'] != u['id'])
        status, body = request('/rest/v1/rpc/mark_training_completed', token, 'POST',
            {'p_id': foreign['weekly'], 'p_completed': True})
        check('completion_rpc_enforces_ownership',
            status in (200, 204) if admin else status == 403, status)
        status, body = request('/rest/v1/rpc/mark_training_completed', token, 'POST',
            {'p_id': u['weekly'], 'p_completed': None})
        check('completion_rpc_rejects_null_state', status == 400, status)
        status, body = request('/rest/v1/rpc/has_paid_access', token, 'POST',
            {'p_require_premium': True})
        check('internal_helper_not_public_rpc', status == 404, status)
        if not admin:
            status, rows = request('/rest/v1/profiles?id=eq.' + u['id'], token, 'PATCH',
                {'role': 'admin'}, True)
            check('self_promotion_denied', status in (200, 204, 403) and not rows, status)
            status, rows = request('/rest/v1/club_subscription_monthly_dues?id=eq.' + u['dues'],
                token, 'PATCH', {'status': 'paid'}, True)
            check('self_payment_denied', status in (200, 204, 403) and (not rows or status == 403), status)
            status, rows = request('/rest/v1/activity_registrations', token, 'POST',
                {'activity_id': cfg['activity'], 'user_id': u['id']}, True)
            check('registration_requires_payment',
                (status == 201 and len(rows) == 1) if u['paid'] else status == 403, status)
            if u['paid']:
                registration = rows[0]['id']
                status, rows = request('/rest/v1/activity_registrations?id=eq.' + registration,
                    token, 'DELETE', representation=True)
                check('can_cancel_own_registration', status == 200 and len(rows) == 1, status)
            foreign = next(x for x in cfg['users'] if x['id'] != u['id'])
            status, rows = request('/rest/v1/activity_registrations', token, 'POST',
                {'activity_id': cfg['activity'], 'user_id': foreign['id']}, True)
            check('foreign_registration_denied', status == 403, status)
            status, rows = request('/rest/v1/session_bookings', token, 'POST',
                {'session_id': cfg['users'][-1]['session'], 'user_id': u['id'], 'status': 'confirmed'}, True)
            check('booking_requires_payment',
                (status == 201 and len(rows) == 1) if u['paid'] else status == 403, status)
            if u['paid']:
                booking = rows[0]['id']
                status, rows = request('/rest/v1/session_bookings?id=eq.' + booking, token, 'PATCH',
                    {'status': 'cancelled'}, True)
                check('can_cancel_own_booking', status == 200 and len(rows) == 1 and rows[0]['status'] == 'cancelled', status)
    except Exception as error:
        if not isinstance(error, AssertionError):
            checks.append({'case': u['label'], 'check': type(error).__name__, 'pass': False})
    finally:
        if token:
            status, _ = request('/auth/v1/logout?scope=global', token, 'POST')
            checks.append({'case': u['label'], 'check': 'logout', 'pass': status == 204, 'http': status})
            status, _ = request('/auth/v1/token?grant_type=refresh_token', method='POST', data={'refresh_token': refresh})
            checks.append({'case': u['label'], 'check': 'refresh_revoked_after_logout', 'pass': status in (400, 401, 403), 'http': status})
    return checks


with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    results = [item for group in pool.map(run_user, cfg['users']) for item in group]
status, rows = request('/rest/v1/weekly_training_plan?select=id')
results.append({'case': 'anon', 'check': 'plans_hidden', 'pass': status == 200 and rows == [], 'http': status})
status, body = request('/rest/v1/rpc/mark_training_completed', method='POST',
    data={'p_id': cfg['users'][0]['weekly'], 'p_completed': True})
results.append({'case': 'anon', 'check': 'completion_rpc_denied', 'pass': status in (401, 403), 'http': status})
report = {'scope': 'TEST Auth and REST API; browser UI not tested',
    'total': len(results), 'passed': sum(r['pass'] for r in results),
    'failed': [r for r in results if not r['pass']], 'checks': results}
print(json.dumps(report, indent=2))
sys.exit(bool(report['failed']))
