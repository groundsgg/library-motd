"""Local status-only native-client fixture. Never accepts game/login packets."""
import json
import socket
import sys
import threading


def varint(value):
    result = bytearray()
    while value > 127:
        result.append((value & 127) | 128)
        value >>= 7
    result.append(value)
    return bytes(result)


def read_varint(client):
    value = 0
    for shift in range(0, 35, 7):
        chunk = client.recv(1)
        if not chunk:
            raise EOFError()
        value |= (chunk[0] & 127) << shift
        if chunk[0] < 128:
            return value
    raise ValueError("Invalid VarInt")


def packet(client):
    size = read_varint(client)
    if not 0 < size <= 8192:
        raise ValueError("Invalid packet size")
    result = bytearray()
    while len(result) < size:
        part = client.recv(size - len(result))
        if not part:
            raise EOFError()
        result.extend(part)
    return bytes(result)


def serve(client):
    with client:
        client.settimeout(5)
        try:
            handshake = packet(client)
            if handshake[0] != 0 or packet(client) != b"\x00":
                return
            body = json.dumps(status, separators=(",", ":")).encode()
            response = b"\x00" + varint(len(body)) + body
            client.sendall(varint(len(response)) + response)
            print("Status response sent", flush=True)
            ping = packet(client)
            if len(ping) == 9 and ping[0] == 1:
                client.sendall(varint(len(ping)) + ping)
        except (EOFError, ValueError, OSError):
            pass


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf8") as source:
        status = json.load(source)
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 25591
    with socket.socket() as server:
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(("127.0.0.1", port))
        server.listen()
        print(f"Status-only fixture on 127.0.0.1:{port}", flush=True)
        while True:
            client, _ = server.accept()
            threading.Thread(target=serve, args=(client,), daemon=True).start()
