"""Real Auth/REST tests for privately provisioned disposable TEST fixtures.
Never production. The SQL orchestrator provisions and removes these fixtures.
Usage: python messaging_api_test_only.py /private/fixtures.json
No credentials, message bodies or tokens are written to the result.
"""
import json
import sys
import urllib.request
import urllib.error
import uuid

cfg = json.load(open(sys.argv[1]))
assert cfg['url'] == 'https://bsykqjiownewnzguilli.supabase.co', 'TEST-only guard'
checks, tokens = [], []

def request(path, token=None, method='GET', data=None):
    headers = {'apikey': cfg['key'], 'Content-Type': 'application/json', 'Prefer': 'return=representation'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(cfg['url'] + path, headers=headers, method=method,
        data=None if data is None else json.dumps(data).encode())
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            return error.code, json.loads(raw) if raw else None
        except ValueError:
            return error.code, None

def check(name, passed, status=None):
    checks.append({'check': name, 'pass': bool(passed), 'http': status})
    if not passed:
        raise AssertionError(name)

try:
    for index, user in enumerate(cfg['users']):
        status, auth = request('/auth/v1/token?grant_type=password', method='POST', data={'email': user['email'], 'password': user['password']})
        check('login_' + str(index), status == 200 and bool(auth.get('access_token')), status)
        tokens.append(auth['access_token'])
        check('identity_' + str(index), auth['user']['id'] == user['id'])
    a, b, coach = cfg['users']
    ta, tb, tc = tokens
    mid = str(uuid.uuid4())
    payload = {'p_athlete': a['id'], 'p_id': mid, 'p_body': 'Synthetic API question', 'p_training': None}
    status, first = request('/rest/v1/rpc/messaging_send', ta, 'POST', payload)
    check('client_send', status == 200 and first.get('sender_id') == a['id'], status)
    status, repeat = request('/rest/v1/rpc/messaging_send', ta, 'POST', payload)
    check('retry_no_duplicate', status == 200 and repeat.get('seq') == first['seq'], status)
    status, rows = request('/rest/v1/club_messages?select=id,athlete_id&id=eq.' + mid, tb)
    check('foreign_history_hidden', status == 200 and rows == [], status)
    status, body = request('/rest/v1/rpc/messaging_send', tb, 'POST', {**payload, 'p_id': str(uuid.uuid4())})
    check('foreign_send_denied', status == 403, status)
    status, body = request('/rest/v1/club_messages', ta, 'POST', {'id': str(uuid.uuid4()), 'athlete_id': a['id'], 'sender_id': coach['id'], 'body': 'Forged'})
    check('forged_sender_denied', status in (401, 403), status)
    status, response = request('/rest/v1/rpc/messaging_send', tc, 'POST', {'p_athlete': a['id'], 'p_id': str(uuid.uuid4()), 'p_body': 'Synthetic coach reply', 'p_training': None})
    check('coach_reply', status == 200 and response.get('sender_id') == coach['id'], status)
    status, inbox = request('/rest/v1/rpc/messaging_inbox', ta, 'POST', {})
    check('client_inbox_only_self', status == 200 and len(inbox) == 1 and inbox[0]['athlete_id'] == a['id'], status)
    check('client_unread_reply', inbox[0]['unread'] == 1)
    status, _ = request('/rest/v1/rpc/messaging_mark_read', ta, 'POST', {'p_athlete': a['id'], 'p_seq': response['seq']})
    check('read_receipt', status in (200, 204), status)
    status, inbox = request('/rest/v1/rpc/messaging_inbox', ta, 'POST', {})
    check('unread_cleared', status == 200 and inbox[0]['unread'] == 0, status)
    status, _ = request('/rest/v1/rpc/messaging_mark_read', tb, 'POST', {'p_athlete': a['id'], 'p_seq': response['seq']})
    check('foreign_read_receipt_denied', status == 403, status)
    status, rows = request('/rest/v1/club_messages?select=id,athlete_id&athlete_id=eq.' + a['id'], tc)
    check('coach_reads_conversation', status == 200 and len(rows) == 2, status)
    status, rows = request('/rest/v1/club_messages?id=eq.' + mid, ta, 'PATCH', {'body': 'Changed'})
    check('message_edit_denied', status in (401, 403), status)
    status, rows = request('/rest/v1/club_messages?id=eq.' + mid, ta, 'DELETE')
    check('message_delete_denied', status in (401, 403), status)
    status, _ = request('/rest/v1/rpc/messaging_inbox', method='POST', data={})
    check('anon_inbox_denied', status in (401, 403), status)
    status, _ = request('/rest/v1/club_messages?select=id')
    check('anon_history_denied', status in (401, 403), status)
except Exception as error:
    checks.append({'check': 'suite_finished', 'pass': False, 'error_type': type(error).__name__})
finally:
    for index, token in enumerate(tokens):
        try:
            status, _ = request('/auth/v1/logout', token, 'POST')
            checks.append({'check': 'logout_' + str(index), 'pass': status in (200, 204), 'http': status})
        except Exception as error:
            checks.append({'check': 'logout_' + str(index), 'pass': False, 'error_type': type(error).__name__})
    result = {'environment': 'TEST', 'passed': sum(c['pass'] for c in checks), 'failed': sum(not c['pass'] for c in checks), 'checks': checks}
    print(json.dumps(result, indent=2))
    sys.exit(1 if result['failed'] else 0)
