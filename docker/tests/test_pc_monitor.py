import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('pc_monitor', ROOT / 'docker/windows-monitor.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


class MonitorTests(unittest.TestCase):
    def test_two_failures_alert_once_then_recovery(self):
        state, notice = monitor.advance({}, False, 10)
        self.assertIsNone(notice)
        state, notice = monitor.advance(state, False, 20)
        self.assertEqual(notice, 'failure')
        state = monitor.confirm_notice(state, notice, 20)
        state, notice = monitor.advance(state, False, 30)
        self.assertIsNone(notice)
        state, notice = monitor.advance(state, True, 40)
        self.assertEqual(notice, 'recovery')
        state = monitor.confirm_notice(state, notice, 40)
        state, notice = monitor.advance(state, True, 50)
        self.assertIsNone(notice)

    def test_email_failure_keeps_pending_notice(self):
        state, _ = monitor.advance({}, False, 10)
        state, notice = monitor.advance(state, False, 20)
        self.assertEqual(notice, 'failure')
        state, notice = monitor.advance(state, False, 30)
        self.assertEqual(notice, 'failure')

    def test_transient_failure_never_sends_recovery(self):
        state, _ = monitor.advance({}, False, 10)
        state, notice = monitor.advance(state, True, 20)
        self.assertIsNone(notice)
        self.assertEqual(state['failures'], 0)

    def test_failed_recovery_notice_is_retried(self):
        state = {'failures': 2, 'alerted': True}
        state, notice = monitor.advance(state, True, 20)
        self.assertEqual(notice, 'recovery')
        state, notice = monitor.advance(state, True, 30)
        self.assertEqual(notice, 'recovery')

    def test_unsent_failure_notice_clears_when_site_recovers(self):
        state = {'failures': 2, 'alerted': False, 'notification_pending': True}
        state, notice = monitor.advance(state, True, 20)
        self.assertIsNone(notice)
        self.assertNotIn('notification_pending', state)


if __name__ == '__main__':
    unittest.main()
