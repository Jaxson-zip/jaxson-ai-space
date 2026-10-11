#!/usr/bin/env python3
"""Private backup format: RSA-OAEP-SHA256 wrapped AES-256-GCM stream.

Only public recovery keys belong on the source server. Never expose unauthenticated
plaintext: decryption stays in a private partial file until the tag is verified.
"""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import struct
import tarfile
import tempfile
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

MAGIC = b'JAXSONBACKUPv1\x00'
MAX_SIZE = 8 * 1024**3


def generate_keypair():
    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    return (key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                              serialization.NoEncryption()),
            key.public_key().public_bytes(serialization.Encoding.PEM,
                                          serialization.PublicFormat.SubjectPublicKeyInfo))


def oaep():
    return padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None)


def regular(path):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError('Expected a regular file')
    return path


def finish_partial(partial, target):
    # link is exclusive on both Linux and NTFS; rename would overwrite on Linux.
    os.link(partial, target)
    partial.unlink()


def encrypted_output(target):
    target = Path(target)
    if target.exists() or target.is_symlink():
        raise FileExistsError('Output already exists')
    partial = target.with_name(target.name + '.partial')
    handle = os.fdopen(os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb')
    return partial, handle


def encrypt_file(source, target, public_pem):
    source = regular(source)
    if source.stat().st_size > MAX_SIZE:
        raise ValueError('Backup exceeds limit')
    public = serialization.load_pem_public_key(public_pem)
    if not isinstance(public, rsa.RSAPublicKey) or public.key_size < 3072:
        raise ValueError('Expected RSA recovery public key of at least 3072 bits')
    key, nonce = os.urandom(32), os.urandom(12)
    wrapped = public.encrypt(key, oaep())
    header = MAGIC + struct.pack('!H', len(wrapped)) + wrapped + nonce
    encryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    encryptor.authenticate_additional_data(header)
    partial, output = encrypted_output(target)
    try:
        with output, source.open('rb') as stream:
            output.write(header)
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                output.write(encryptor.update(chunk))
            output.write(encryptor.finalize())
            output.write(encryptor.tag)
            output.flush()
            os.fsync(output.fileno())
        finish_partial(partial, target)
    except Exception:
        partial.unlink(missing_ok=True)
        raise


def decrypt_file(source, target, private_pem):
    source = regular(source)
    if source.stat().st_size > MAX_SIZE + 2048:
        raise ValueError('Backup exceeds limit')
    private = serialization.load_pem_private_key(private_pem, password=None)
    if not isinstance(private, rsa.RSAPrivateKey) or private.key_size < 3072:
        raise ValueError('Invalid private recovery key')
    with source.open('rb') as stream:
        if stream.read(len(MAGIC)) != MAGIC:
            raise ValueError('Unsupported encrypted backup')
        length_bytes = stream.read(2)
        length = struct.unpack('!H', length_bytes)[0]
        if not 384 <= length <= 1024:
            raise ValueError('Invalid envelope')
        wrapped, nonce = stream.read(length), stream.read(12)
        header = MAGIC + length_bytes + wrapped + nonce
        remaining = source.stat().st_size - len(header) - 16
        if remaining < 0 or len(wrapped) != length or len(nonce) != 12:
            raise ValueError('Truncated encrypted backup')
        stream.seek(-16, os.SEEK_END)
        tag = stream.read(16)
        stream.seek(len(header))
        key = private.decrypt(wrapped, oaep())
        decryptor = Cipher(algorithms.AES(key), modes.GCM(nonce, tag)).decryptor()
        decryptor.authenticate_additional_data(header)
        partial, output = encrypted_output(target)
        try:
            with output:
                while remaining:
                    chunk = stream.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise ValueError('Truncated encrypted backup')
                    remaining -= len(chunk)
                    output.write(decryptor.update(chunk))
                output.write(decryptor.finalize())
                output.flush()
                os.fsync(output.fileno())
            finish_partial(partial, target)
        except Exception:
            partial.unlink(missing_ok=True)
            raise


def snapshot_sqlite(source, target):
    source = regular(source)
    if Path(target).exists():
        raise FileExistsError('Snapshot already exists')
    # backup() includes WAL commits and coordinates with a running writer.
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True, timeout=10)) as live:
        with closing(sqlite3.connect(target)) as copy:
            live.backup(copy)
            if copy.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('SQLite snapshot failed integrity check')
    Path(target).chmod(0o600)


def add_private_tree(source, prefix, entries):
    source = Path(source)
    if source.is_symlink():
        raise ValueError('Symlink source rejected')
    if source.is_file():
        entries.append((source, prefix))
    elif source.is_dir():
        for child in sorted(source.iterdir()):
            if child.name == 'node_modules':
                continue  # Runtime dependencies are reinstallable, not login state.
            add_private_tree(child, f'{prefix}/{child.name}', entries)
    else:
        raise ValueError('Special file rejected')


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def pack_bundle(release_snapshot, gateway_root, target):
    from release_snapshot import verify
    release = verify(Path(release_snapshot), database='jaxson_release_20261007')
    gateway_root = Path(gateway_root)
    entries = []
    add_private_tree(release_snapshot, 'release', entries)
    for name in ('compose.yaml', 'inbox.env'):
        add_private_tree(gateway_root / name, f'gateway/{name}', entries)
    state = gateway_root / 'state'
    # Preserve actual source patches and login/context. Skip caches, logs, old config
    # copies and agent chat transcripts. No active SQLite file is copied as bytes.
    for name in ('openclaw.json', 'extensions', 'openclaw-weixin', 'state'):
        add_private_tree(state / name, f'gateway/state/{name}', entries)
    target = Path(target)
    if target.exists():
        raise FileExistsError('Bundle already exists')
    with tempfile.TemporaryDirectory(prefix='jaxson-private-', dir=target.parent) as directory:
        staging = Path(directory)
        ledger = staging / 'receipts.sqlite'
        snapshot_sqlite(state / 'jaxson-inbox/todo-receipts.sqlite', ledger)
        entries.append((ledger, 'gateway/state/jaxson-inbox/todo-receipts.sqlite'))
        manifest = {'version': 1, 'release': release, 'files': {}}
        copied = []
        for index, (source, name) in enumerate(entries):
            before = source.stat()
            snapshot = staging / f'file-{index}'
            shutil.copyfile(source, snapshot)
            snapshot.chmod(0o600)
            after = source.stat()
            if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
                raise ValueError('Source changed during capture; retry next backup')
            manifest['files'][name] = {'sha256': digest(snapshot), 'size': snapshot.stat().st_size}
            copied.append((snapshot, name))
        manifest_file = staging / 'manifest.json'
        manifest_file.write_text(json.dumps(manifest, sort_keys=True), encoding='utf8')
        with target.open('xb') as output, tarfile.open(fileobj=output, mode='w:gz') as archive:
            for source, name in [*copied, (manifest_file, 'manifest.json')]:
                archive.add(source, arcname=name, recursive=False)
    target.chmod(0o600)


def verify_bundle(source):
    from release_snapshot import verify
    source = regular(source)
    # Extract into a fresh private directory, only normal relative files. Do not
    # invoke tar extractall or execute any archived configuration/SQL.
    with tempfile.TemporaryDirectory(prefix='jaxson-verify-', dir=source.parent) as directory:
        root = Path(directory)
        seen, total = set(), 0
        with tarfile.open(source, 'r:gz') as archive:
            for member in archive:
                name = member.name
                path = PurePosixPath(name)
                if (not member.isfile() or path.is_absolute() or '..' in path.parts or
                        '\\' in name or str(path) != name or name in seen or
                        not (name == 'manifest.json' or name.startswith(('release/', 'gateway/')))):
                    raise ValueError('Unsafe bundle member')
                seen.add(name)
                total += member.size
                if total > MAX_SIZE or len(seen) > 20000 or (name == 'manifest.json' and member.size > 4 * 1024**2):
                    raise ValueError('Oversized bundle')
                destination = root / name
                destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with archive.extractfile(member) as stream, destination.open('xb') as output:
                    shutil.copyfileobj(stream, output)
                destination.chmod(0o600)
        manifest = json.loads((root / 'manifest.json').read_text(encoding='utf8'))
        if manifest['version'] != 1 or set(manifest['files']) != seen - {'manifest.json'}:
            raise ValueError('Manifest file list mismatch')
        for name, expected in manifest['files'].items():
            file = root / name
            if expected != {'sha256': digest(file), 'size': file.stat().st_size}:
                raise ValueError('Bundle checksum mismatch')
        release = verify(root / 'release', database='jaxson_release_20261007')
        if manifest['release'] != release:
            raise ValueError('Release metadata mismatch')
        for name in ('gateway/compose.yaml', 'gateway/inbox.env', 'gateway/state/openclaw.json'):
            regular(root / name)
        with closing(sqlite3.connect((root / 'gateway/state/jaxson-inbox/todo-receipts.sqlite').as_uri() + '?mode=ro', uri=True)) as db:
            if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('Invalid receipt database')
        return {'verified': True, 'files': len(manifest['files']), 'release_created_at': release['created_at']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['encrypt', 'decrypt', 'pack', 'verify'])
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--target', type=Path)
    parser.add_argument('--key', type=Path)
    parser.add_argument('--gateway', type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        if args.action == 'verify':
            print(json.dumps(verify_bundle(args.source)))
        elif args.action == 'pack':
            pack_bundle(args.source, args.gateway, args.target)
        else:
            operation = encrypt_file if args.action == 'encrypt' else decrypt_file
            operation(args.source, args.target, regular(args.key).read_bytes())
    except Exception:
        parser.exit(1, 'Private backup operation failed; no private data is logged.\n')


if __name__ == '__main__':
    main()
