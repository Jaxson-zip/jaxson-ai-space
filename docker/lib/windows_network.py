"""Bind owner operations to a selected Windows adapter without changing routes."""
import base64
from functools import lru_cache
import ipaddress
import json
import os
import re
import smtplib
import socket
import subprocess
import urllib.parse
import urllib.request


@lru_cache(maxsize=4)
def interface_details(alias):
    if not isinstance(alias, str) or not re.fullmatch(r'[A-Za-z0-9 _-]{1,64}', alias):
        raise ValueError('Invalid owner network interface')
    script = ("$n=Get-NetIPConfiguration -InterfaceAlias '" + alias + "' -ErrorAction Stop; "
              "@{index=$n.InterfaceIndex;address=@($n.IPv4Address.IPAddress)[0]}|ConvertTo-Json -Compress")
    encoded = base64.b64encode(script.encode('utf-16le')).decode()
    data = json.loads(subprocess.check_output(['powershell.exe', '-NoProfile', '-NonInteractive',
        '-WindowStyle', 'Hidden', '-EncodedCommand', encoded], text=True, encoding='utf-8',
        stderr=subprocess.DEVNULL, timeout=20, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)))
    if not isinstance(data['index'], int) or not 1 <= data['index'] <= 65535:
        raise ValueError('Invalid adapter index')
    return data['index'], str(ipaddress.IPv4Address(data['address']))


def public_address(host):
    try:
        address = ipaddress.IPv4Address(host)
    except ipaddress.AddressValueError:
        address = ipaddress.IPv4Address(socket.gethostbyname(host))
    if address in ipaddress.IPv4Network('198.18.0.0/15'):
        # A proxy's synthetic DNS address cannot be used on the physical adapter.
        # Resolve the public SMTP hostname over authenticated HTTPS instead.
        url = 'https://cloudflare-dns.com/dns-query?' + urllib.parse.urlencode({'name': host, 'type': 'A'})
        request = urllib.request.Request(url, headers={'Accept': 'application/dns-json'})
        with urllib.request.urlopen(request, timeout=15) as response:
            data = response.read(65537)
        if len(data) > 65536:
            raise ValueError('Oversized DNS response')
        answers = json.loads(data)['Answer']
        address = next(ipaddress.IPv4Address(item['data']) for item in answers if item['type'] == 1)
    if not address.is_global:
        raise ValueError('Owner destination must be a public address')
    return str(address)


def direct_connection(host, port, timeout, interface):
    if os.name != 'nt' or port not in (22, 465):
        raise ValueError('Only owner SSH and secure SMTP use this adapter binding')
    index, source = interface_details(interface)
    address = public_address(host)
    connection = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        connection.settimeout(timeout)
        # Windows IP_UNICAST_IF expects the interface index in network byte order.
        connection.setsockopt(socket.IPPROTO_IP, 31, socket.htonl(index))
        connection.bind((source, 0))
        connection.connect((address, port))
        return connection
    except Exception:
        connection.close()
        raise


class DirectSMTP(smtplib.SMTP_SSL):
    def __init__(self, owner_interface, *args, **kwargs):
        self.owner_interface = owner_interface
        super().__init__(*args, **kwargs)

    def _get_socket(self, host, port, timeout):
        raw = direct_connection(host, port, timeout, self.owner_interface)
        try:
            return self.context.wrap_socket(raw, server_hostname=host)
        except Exception:
            raw.close()
            raise
