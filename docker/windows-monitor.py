#!/usr/bin/env python3
"""Current-user PC monitor. Cannot monitor while the PC is off/asleep."""
import argparse
import datetime as dt
from email.message import EmailMessage
import json
from pathlib import Path
import smtplib
import ssl
import time
import urllib.request


def advance(previous, healthy, now):
    state = dict(previous)
    state['checked_at'] = now
    state['failures'] = 0 if healthy else min(state.get('failures', 0) + 1, 1000)
    if healthy:
        if not state.get('alerted'):
            state.pop('notification_pending', None)
        return state, 'recovery' if state.get('alerted') else None
    return state, 'failure' if state['failures'] >= 2 and not state.get('alerted') else None


def confirm_notice(state, notice, now):
    return {**state, 'alerted': notice == 'failure', 'notified_at': now}


def check_url(url):
    return probe_url(url)['healthy']


def probe_url(url):
    if url not in ('https://jaxson.bond/', 'https://api.jaxson.bond/api/showcase-projects',
                   'https://todo-theta-mauve-75.vercel.app/'):
        raise ValueError('Unexpected monitoring destination')
    try:
        started = time.monotonic()
        request = urllib.request.Request(url, headers={'User-Agent': 'Jaxson-Owner-Availability/1.0',
                                                      'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(request, timeout=15, context=ssl.create_default_context()) as response:
            if response.geturl() != url or response.status != 200:
                return {'healthy': False, 'reason': 'HTTP_STATUS_OR_REDIRECT'}
            if '/api/' in url:
                raw = response.read(1024 * 1024 + 1)
                if len(raw) > 1024 * 1024:
                    return {'healthy': False, 'reason': 'OVERSIZED_RESPONSE'}
                payload = json.loads(raw)
                healthy = isinstance(payload.get('projects'), list)
            else:
                healthy = bool(response.read(256))
            return {'healthy': healthy, 'reason': 'OK' if healthy else 'INVALID_BODY',
                    'elapsed_ms': round((time.monotonic() - started) * 1000)}
    except Exception as error:
        return {'healthy': False, 'reason': type(error).__name__}


def send_notice(config, notice, checks):
    env = config['smtp']
    if config['to'] != '15347640609@163.com' or env['SMTP_USER'] != config['to']:
        raise ValueError('Notification recipient is outside authorized owner')
    if env.get('SMTP_HOST') != 'smtp.163.com' or str(env.get('SMTP_PORT')) != '465':
        raise ValueError('Expected existing secure 163 SMTP')
    message = EmailMessage()
    message['From'] = config['to']
    message['To'] = config['to']
    message['Subject'] = {'failure': 'Jaxson 网站可用性告警', 'recovery': 'Jaxson 网站可用性恢复',
                          'test': 'Jaxson 本机监测邮件测试'}[notice]
    message.set_content('这是本机运维监测通知。\n时间（UTC）：' + dt.datetime.now(dt.timezone.utc).isoformat() +
                        '\n' + '\n'.join(f'{url}: {"正常" if healthy else "检查失败"}' for url, healthy in checks.items()) +
                        '\n未包含网页正文、服务器日志或密钥。\n电脑关机或休眠时此监测不会执行。')
    with smtplib.SMTP_SSL('smtp.163.com', 465, timeout=20, context=ssl.create_default_context()) as smtp:
        smtp.login(env['SMTP_USER'], env['SMTP_PASSWORD'])
        if smtp.send_message(message):
            raise RuntimeError('SMTP recipient rejected')


def run(config_file, test_only=False):
    config = json.loads(Path(config_file).read_text(encoding='utf8'))
    state_file = Path(config['state_file'])
    if test_only:
        send_notice(config, 'test', {})
        return {'test_mail_accepted': True}
    previous = json.loads(state_file.read_text(encoding='utf8')) if state_file.exists() else {}
    probes = {url: probe_url(url) for url in config['urls']}
    checks = {url: probe['healthy'] for url, probe in probes.items()}
    try:
        backup = json.loads(Path(config['backup_metadata']).read_text(encoding='utf8'))
        created = dt.datetime.strptime(backup['release_created_at'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc)
        age = (dt.datetime.now(dt.timezone.utc) - created).total_seconds()
        checks['本机生产备份不超过36小时'] = bool(backup['verified']) and -60 <= age <= 36 * 3600
    except Exception:
        checks['本机生产备份不超过36小时'] = False
    state, notice = advance(previous, all(checks.values()), time.time())
    state['checks'] = checks
    state['probes'] = probes  # Codes/timings only; never response bodies or exceptions.
    notification_sent = False
    if notice:
        try:
            send_notice(config, notice, checks)
            state = confirm_notice(state, notice, time.time())
            notification_sent = True
        except Exception:
            state['notification_pending'] = True
    if notification_sent:
        state.pop('notification_pending', None)
    partial = state_file.with_name(state_file.name + '.partial')
    partial.write_text(json.dumps(state), encoding='utf8')
    partial.replace(state_file)
    return {'healthy': all(checks.values()), 'checks': checks, 'notification_sent': notification_sent,
            'notification_pending': bool(state.get('notification_pending'))}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--send-test', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(run(args.config, args.send_test), ensure_ascii=False))
    except Exception:
        print(json.dumps({'ok': False, 'error': 'MONITOR_CONFIGURATION_OR_DELIVERY_FAILED'}))
        raise SystemExit(1)
