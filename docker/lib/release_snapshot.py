#!/usr/bin/env python3
"""Strict release snapshot/artifact validation; never executes archived SQL/config."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import tarfile

SNAPSHOT_FILES = {"database.dump", "media.tar.gz", "config.tar.gz", "database-roles.sql", "metadata.txt"}
CONFIG_FILES = {"production.env", "compose.yaml", "Caddyfile"}


def fail(message):
    raise ValueError(message)


def regular(path):
    if path.is_symlink() or not path.is_file():
        fail(f"Expected a regular file: {path.name}")


def checksums(directory, names):
    regular(directory / "SHA256SUMS")
    if (directory / "SHA256SUMS").stat().st_size > 4096:
        fail("Oversized checksum manifest")
    lines = (directory / "SHA256SUMS").read_text(encoding="ascii").splitlines()
    seen = set()
    for line in lines:
        match = re.fullmatch(r"([a-f0-9]{64})  ([A-Za-z0-9_.-]+)", line)
        if not match or match[2] not in names or match[2] in seen:
            fail("Invalid, duplicate or unexpected checksum entry")
        name = match[2]
        seen.add(name)
        regular(directory / name)
        digest = hashlib.sha256()
        with (directory / name).open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != match[1]:
            fail(f"Checksum mismatch: {name}")
    if seen != names:
        fail("Missing checksum entry")


def archive_members(path, config=False):
    seen = set()
    total = 0
    members = []
    with tarfile.open(path, "r:gz") as archive:
        for item in archive:
            raw = item.name
            if raw.startswith("/") or "\\" in raw or "\x00" in raw or ".." in PurePosixPath(raw).parts:
                fail(f"Unsafe archive path: {raw!r}")
            name = str(PurePosixPath(raw))
            if name in seen or not (item.isfile() or item.isdir()):
                fail("Duplicate path or unsafe archive file type")
            if config and (name not in CONFIG_FILES or not item.isfile()):
                fail("Unexpected config member")
            if name == "." and not item.isdir():
                fail("Archive root must be a directory")
            total += item.size
            if total > 20 * 1024**3 or len(seen) > 100000:
                fail("Archive exceeds size/member limit")
            seen.add(name)
            members.append(item)
    if config and seen != CONFIG_FILES:
        fail("Missing config member")
    return members


def verify(directory, database=None, release=None, max_age=None):
    if directory.is_symlink() or not directory.is_dir():
        fail("Snapshot must be a real directory")
    regular(directory / "COMPLETE")
    if (directory / "INCOMPLETE").exists() or (directory / "INCOMPLETE").is_symlink():
        fail("Snapshot is incomplete")
    checksums(directory, SNAPSHOT_FILES)
    if (directory / "metadata.txt").stat().st_size > 4096:
        fail("Oversized snapshot metadata")
    metadata = {}
    for line in (directory / "metadata.txt").read_text(encoding="utf-8").splitlines():
        key, sep, value = line.partition("=")
        if not sep or key in metadata or key not in {"database", "release", "created_at"}:
            fail("Invalid snapshot metadata")
        metadata[key] = value
    if set(metadata) != {"database", "release", "created_at"}:
        fail("Missing snapshot metadata")
    if not re.fullmatch(r"jaxson_release_[A-Za-z0-9_]+", metadata["database"]):
        fail("Snapshot database is outside the release scope")
    if not re.fullmatch(r"/opt/jaxson-releases/[A-Za-z0-9][A-Za-z0-9_.-]*", metadata["release"]) or metadata["release"].endswith("/current"):
        fail("Invalid source release")
    if database and metadata["database"] != database:
        fail("Snapshot belongs to a different database")
    if release and metadata["release"] != release:
        fail("Snapshot belongs to a different release")
    created = dt.datetime.strptime(metadata["created_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
    if max_age is not None:
        age = (dt.datetime.now(dt.timezone.utc) - created).total_seconds()
        if age < -60 or age > max_age:
            fail("Recovery snapshot is not fresh")
    with (directory / "database.dump").open("rb") as handle:
        if handle.read(5) != b"PGDMP":
            fail("Expected a PostgreSQL custom-format dump")
    archive_members(directory / "media.tar.gz")
    archive_members(directory / "config.tar.gz", config=True)
    return metadata


def extract_media(directory, destination):
    verify(directory)
    if destination.is_symlink() or not destination.is_dir() or any(destination.iterdir()):
        fail("Media destination must be a real, empty directory")
    members = archive_members(directory / "media.tar.gz")
    with tarfile.open(directory / "media.tar.gz", "r:gz") as archive:
        for item in members:
            target = destination / str(PurePosixPath(item.name))
            if item.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(item) as source, target.open("xb") as output:
                    for chunk in iter(lambda: source.read(1024 * 1024), b""):
                        output.write(chunk)
                target.chmod(item.mode & 0o777 & ~0o022)


def artifact(directory):
    checksums(directory, {"images.tar", "artifact.json"})
    metadata = json.loads((directory / "artifact.json").read_text(encoding="utf-8"))
    if set(metadata) != {"version", "release_id", "web_image", "portfolio_image", "migrations"} or metadata["version"] != 1:
        fail("Unsupported release artifact metadata")
    if not re.fullmatch(r"[a-f0-9]{40}", metadata["release_id"]):
        fail("Release ID must be the full Git commit SHA")
    for key in ("web_image", "portfolio_image"):
        if not re.fullmatch(r"sha256:[a-f0-9]{64}", metadata[key]):
            fail("Artifact images must use immutable image IDs")
    migrations = metadata["migrations"]
    if not isinstance(migrations, list) or len(set(migrations)) != len(migrations) or not migrations:
        fail("Invalid migration list")
    if not all(isinstance(value, str) and re.fullmatch(r"[0-9]{8}_[0-9]{6}_[a-z0-9_]+", value) for value in migrations):
        fail("Invalid migration name")
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("verify", "extract-media", "artifact"))
    parser.add_argument("directory", type=Path)
    parser.add_argument("--database")
    parser.add_argument("--release")
    parser.add_argument("--max-age", type=int)
    parser.add_argument("--destination", type=Path)
    parser.add_argument("--field")
    args = parser.parse_args()
    try:
        if args.action == "extract-media":
            if args.destination is None:
                fail("--destination is required")
            extract_media(args.directory, args.destination)
            return
        value = artifact(args.directory) if args.action == "artifact" else verify(args.directory, args.database, args.release, args.max_age)
        if args.field:
            selected = value[args.field]
            print("\n".join(selected) if isinstance(selected, list) else selected)
        else:
            print(json.dumps(value, sort_keys=True))
    except (ValueError, OSError, KeyError, tarfile.TarError) as error:
        parser.exit(1, f"Rejected: {error}\n")


if __name__ == "__main__":
    main()
