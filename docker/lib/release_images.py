#!/usr/bin/env python3
"""Verify build config identity across classic and containerd Docker image stores."""
import hashlib
import json
import re
import subprocess
import sys

DIGEST = re.compile(r'sha256:[a-f0-9]{64}')

def resolve_image(reference, expected, run=subprocess.check_output):
    if not DIGEST.fullmatch(expected):
        raise ValueError('Invalid build image digest')
    image = json.loads(run(['docker', 'image', 'inspect', reference]))[0]
    actual = image['Id']
    if not DIGEST.fullmatch(actual):
        raise ValueError('Invalid loaded image digest')
    if actual == expected:
        return actual
    # Docker's classic store reports a config digest; containerd reports an OCI
    # target digest. Verify the target and its config, then pin that runtime ID.
    if image.get('Descriptor', {}).get('digest') != actual:
        raise ValueError('Loaded image differs from verified artifact')
    info = json.loads(run(['docker', 'info', '--format', '{{json .Containerd}}']))
    address = info['Address']
    namespace = info['Namespaces']['Containers']
    if not isinstance(address, str) or not address.startswith('/') or namespace != 'moby':
        raise ValueError('Unexpected Docker containerd endpoint')
    command = ['ctr', '--address', address, '--namespace', namespace, 'content', 'get']
    manifest_bytes = run(command + [actual])
    if 'sha256:' + hashlib.sha256(manifest_bytes).hexdigest() != actual:
        raise ValueError('Corrupted loaded image manifest')
    manifest = json.loads(manifest_bytes)
    if manifest.get('config', {}).get('digest') != expected:
        raise ValueError('Loaded image config differs from verified artifact')
    config_bytes = run(command + [expected])
    if 'sha256:' + hashlib.sha256(config_bytes).hexdigest() != expected:
        raise ValueError('Corrupted loaded image config')
    return actual

if __name__ == '__main__':
    try:
        reference, expected = sys.argv[1:]
        if not re.fullmatch(r'jaxson-(web|portfolio):[a-f0-9]{40}', reference):
            raise ValueError('Unexpected release image reference')
        print(resolve_image(reference, expected))
    except (ValueError, KeyError, IndexError, OSError, subprocess.CalledProcessError):
        sys.exit('Loaded image identity verification failed')
