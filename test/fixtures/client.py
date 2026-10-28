#!/usr/bin/python3
import argparse
import os
import signal
import socket
import sys
import time

parser = argparse.ArgumentParser()
parser.add_argument('--token-path')
parser.add_argument('--firezone-id')
parser.add_argument('--firezone-name')
args = parser.parse_args()

stat = os.stat(args.token_path)
assert stat.st_uid == 0 and stat.st_gid == 0
assert stat.st_mode & 0o777 == 0o600
assert open(args.token_path).read() == 'fixture-token'

def stop(_signal, _frame):
    print('graceful shutdown', flush=True)
    sys.exit(0)

signal.signal(signal.SIGTERM, stop)
if args.firezone_name != 'timeout':
    address = os.environ['NOTIFY_SOCKET']
    if address.startswith('@'):
        address = '\0' + address[1:]
    with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as sock:
        sock.sendto(b'READY=1', address)
    print('ready ' + args.firezone_name, flush=True)
if args.firezone_name == 'crash':
    time.sleep(1)
    sys.exit(42)
while True:
    time.sleep(1)
