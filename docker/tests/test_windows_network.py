"""Direct owner connections keep TLS identity and don't change system routes."""
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / 'lib'))


class NetworkTests(unittest.TestCase):
    def module(self):
        spec = importlib.util.spec_from_file_location('windows_network', ROOT / 'lib/windows_network.py')
        value = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(value)
        return value

    def test_certificate_hostname_stays_smtp_host_when_transport_uses_real_ip(self):
        network = self.module()
        client = object.__new__(network.DirectSMTP)
        client.owner_interface = 'WLAN'
        client.context = Mock()
        raw = Mock()
        with patch.object(network, 'direct_connection', return_value=raw):
            client._get_socket('smtp.163.com', 465, 15)
        client.context.wrap_socket.assert_called_once_with(raw, server_hostname='smtp.163.com')

    def test_certificate_failure_closes_raw_connection(self):
        network = self.module()
        client = object.__new__(network.DirectSMTP)
        client.owner_interface = 'WLAN'
        client.context = Mock()
        client.context.wrap_socket.side_effect = ValueError('certificate failure')
        raw = Mock()
        with patch.object(network, 'direct_connection', return_value=raw):
            with self.assertRaises(ValueError):
                client._get_socket('smtp.163.com', 465, 15)
        raw.close.assert_called_once()

    def test_direct_route_does_not_accept_arbitrary_powershell(self):
        network = self.module()
        with self.assertRaises(ValueError):
            network.interface_details("WLAN'; bad-command")

    def test_private_dns_destination_is_rejected(self):
        network = self.module()
        with patch.object(network.socket, 'gethostbyname', return_value='127.0.0.1'):
            with self.assertRaises(ValueError):
                network.public_address('smtp.163.com')


if __name__ == '__main__':
    unittest.main()
