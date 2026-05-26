#!/usr/bin/env python3
"""
Futuristic Biometric Telemetry Relay WebSocket Server
Bridges clients (Signature Pads, index.html) with receivers (Displays, receiver.html)
"""

import asyncio
import csv
import json
import os
import socket
import sys
from datetime import datetime
from urllib.parse import urlparse, parse_qs, unquote

# Import websockets library
try:
    import websockets
    from websockets.http11 import Response
    from websockets.datastructures import Headers
except ImportError:
    print("Error: 'websockets' library is not installed. Run 'pip install websockets' first.")
    sys.exit(1)

# Configuration
DEFAULT_PORT = 9980
GUEST_LIST_FILENAME = "guestlist.csv"

# Modern Neon Terminal Styles (ANSI Escape Codes)
class Style:
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    PURPLE = "\033[95m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"
    
    # Combined styles
    HEADER = BOLD + CYAN
    SUCCESS = BOLD + GREEN
    WARNING = BOLD + YELLOW
    ALERT = BOLD + RED
    INFO = DIM + CYAN

def get_timestamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

def log_info(msg):
    print(f"[{Style.INFO}{get_timestamp()}{Style.RESET}] {msg}")

def log_success(msg):
    print(f"[{Style.SUCCESS}OK{Style.RESET}] {msg}")

def log_warning(msg):
    print(f"[{Style.WARNING}WARN{Style.RESET}] {msg}")

def log_alert(msg):
    print(f"[{Style.ALERT}ALERT{Style.RESET}] {msg}")

# Dynamic IP Auto-Discovery
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to a public DNS (doesn't send any packets)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def save_guest_list_to_csv(guests):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_dir, GUEST_LIST_FILENAME)
    try:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["Name", "Locked"])
            writer.writeheader()
            for g in guests:
                writer.writerow({"Name": g["name"], "Locked": "1" if g["locked"] else "0"})
    except Exception as e:
        log_alert(f"Failed to save CSV: {e}")

# Guest List Manager
def load_or_create_guest_list():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_dir, GUEST_LIST_FILENAME)
    txt_path = os.path.join(current_dir, "guestlist.txt")
    
    default_guests = [
        "RUDI HERMAWAN",
        "SITI AMINAH",
        "BAMBANG UTOMO",
        "DEWI LESTARI",
        "HENDRA WIJAYA",
        "GUEST ACCESS"
    ]
    
    guests = []
    
    # 1. Try to load from CSV
    if os.path.exists(csv_path):
        try:
            with open(csv_path, "r", newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    name = row.get("Name", "").strip()
                    if name:
                        locked_str = row.get("Locked", "0").strip().lower()
                        locked = locked_str in ("1", "true", "yes")
                        guests.append({"name": name, "locked": locked})
        except Exception as e:
            log_alert(f"Failed to read CSV: {e}")
            
    # 2. Try to migrate from TXT if CSV not found or failed
    if not guests and os.path.exists(txt_path):
        try:
            with open(txt_path, "r", encoding="utf-8") as f:
                txt_names = [line.strip() for line in f if line.strip()]
            for name in txt_names:
                guests.append({"name": name, "locked": False})
            if guests:
                log_success(f"Migrated {len(guests)} names from TXT to CSV.")
                save_guest_list_to_csv(guests)
        except Exception as e:
            log_alert(f"Failed to migrate TXT to CSV: {e}")
            
    # 3. Create default guest list if still empty
    if not guests:
        for name in default_guests:
            guests.append({"name": name, "locked": False})
        save_guest_list_to_csv(guests)
        log_success("Generated a fresh guestlist.csv with default fallback guests.")
        
    # 4. Check signatures dynamically
    signatures_dir = os.path.join(current_dir, "signatures")
    for g in guests:
        safe_name = "".join([c if c.isalnum() else "_" for c in g["name"].strip().lower()])
        sig_path = os.path.join(signatures_dir, f"{safe_name}.json")
        g["has_signature"] = os.path.exists(sig_path)
        
    return guests

def set_guest_lock_status(name, locked):
    guests = load_or_create_guest_list()
    updated = False
    for g in guests:
        if g["name"].strip().lower() == name.strip().lower():
            g["locked"] = locked
            updated = True
    if updated:
        save_guest_list_to_csv(guests)
        status_str = "LOCKED" if locked else "UNLOCKED"
        log_success(f"Guest '{name}' has been {status_str}")
    else:
        log_warning(f"Guest '{name}' not found to update lock status.")

def reset_all_locks():
    guests = load_or_create_guest_list()
    for g in guests:
        g["locked"] = False
    save_guest_list_to_csv(guests)
    
    # Purge all signature files
    current_dir = os.path.dirname(os.path.abspath(__file__))
    signatures_dir = os.path.join(current_dir, "signatures")
    if os.path.exists(signatures_dir):
        for f_name in os.listdir(signatures_dir):
            if f_name.endswith(".json"):
                try:
                    os.remove(os.path.join(signatures_dir, f_name))
                except Exception:
                    pass
    log_success("All guest locks have been reset and signature datasets purged.")

def add_guest_to_csv(name):
    name = name.strip()
    if not name:
        return
    guests = load_or_create_guest_list()
    # Avoid duplicates
    for g in guests:
        if g["name"].lower() == name.lower():
            log_warning(f"Guest '{name}' already exists.")
            return
    guests.append({"name": name, "locked": False})
    save_guest_list_to_csv(guests)
    log_success(f"Added guest '{name}' to list.")

def delete_guest_from_csv(name):
    guests = load_or_create_guest_list()
    new_guests = [g for g in guests if g["name"].lower() != name.lower()]
    if len(new_guests) < len(guests):
        save_guest_list_to_csv(new_guests)
        log_success(f"Deleted guest '{name}' from list.")
    else:
        log_warning(f"Guest '{name}' not found for deletion.")

def save_signature_data(name, strokes):
    if not name or not strokes:
        return
    current_dir = os.path.dirname(os.path.abspath(__file__))
    signatures_dir = os.path.join(current_dir, "signatures")
    if not os.path.exists(signatures_dir):
        try:
            os.makedirs(signatures_dir)
        except Exception as e:
            log_alert(f"Failed to create signatures directory: {e}")
            return
            
    safe_name = "".join([c if c.isalnum() else "_" for c in name.strip().lower()])
    file_path = os.path.join(signatures_dir, f"{safe_name}.json")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump({
                "name": name,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "strokes": strokes
            }, f, indent=2)
        log_success(f"Stored signature dataset for '{name}' to {safe_name}.json")
    except Exception as e:
        log_alert(f"Failed to save signature data for '{name}': {e}")

def delete_signature_data(name):
    if not name:
        return
    current_dir = os.path.dirname(os.path.abspath(__file__))
    signatures_dir = os.path.join(current_dir, "signatures")
    safe_name = "".join([c if c.isalnum() else "_" for c in name.strip().lower()])
    file_path = os.path.join(signatures_dir, f"{safe_name}.json")
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            log_info(f"Purged signature dataset for '{name}' (Ulangi/Reset triggered)")
        except Exception as e:
            log_alert(f"Failed to delete signature data for '{name}': {e}")

def get_last_completed_signature():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    signatures_dir = os.path.join(current_dir, "signatures")
    if not os.path.exists(signatures_dir):
        return None
        
    files = [os.path.join(signatures_dir, f) for f in os.listdir(signatures_dir) if f.endswith(".json")]
    if not files:
        return None
        
    # Sort files by modification time (newest first)
    try:
        files.sort(key=os.path.getmtime, reverse=True)
        last_file = files[0]
        with open(last_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        log_warning(f"Failed to retrieve last completed signature: {e}")
        return None

def get_signature_by_name(name):
    if not name:
        return None
    current_dir = os.path.dirname(os.path.abspath(__file__))
    signatures_dir = os.path.join(current_dir, "signatures")
    if not os.path.exists(signatures_dir):
        return None
        
    safe_name = "".join([c if c.isalnum() else "_" for c in name.strip().lower()])
    file_path = os.path.join(signatures_dir, f"{safe_name}.json")
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log_warning(f"Failed to retrieve signature for '{name}': {e}")
            return None
    return None

# Connection States
clients = set()
receivers = set()
admins = set()

# Live Telemetry Stats Reporting
def report_connection_metrics():
    sys.stdout.write(
        f"\r{Style.DIM}[METRICS] Active Node Mesh: "
        f"{Style.CYAN}{Style.BOLD}{len(clients)} Senders{Style.RESET}{Style.DIM} | "
        f"{Style.GREEN}{Style.BOLD}{len(receivers)} Receivers{Style.RESET}{Style.DIM} | "
        f"{Style.PURPLE}{Style.BOLD}{len(admins)} Admins{Style.RESET}                      "
    )
    sys.stdout.flush()

async def broadcast_guest_list():
    guests = load_or_create_guest_list()
    msg = json.dumps(guests)
    
    # Gather all active targets
    targets = list(clients) + list(receivers) + list(admins)
    if targets:
        await asyncio.gather(
            *[t.send(msg) for t in targets],
            return_exceptions=True
        )

async def register_connection(websocket, *args, **kwargs):
    # Dynamic path extraction supporting legacy and modern (websockets v10+) APIs
    path = None
    if len(args) > 0 and args[0] is not None:
        path = args[0]
    elif "path" in kwargs and kwargs["path"] is not None:
        path = kwargs["path"]
    elif hasattr(websocket, "request") and hasattr(websocket.request, "path"):
        path = websocket.request.path
    elif hasattr(websocket, "path"):
        path = websocket.path
        
    actual_path = path if path is not None else "/"
    
    # Resolve remote socket info
    remote_host, remote_port = websocket.remote_address
    conn_id = f"{remote_host}:{remote_port}"
    
    if "/receiver" in actual_path:
        receivers.add(websocket)
        print() # print new line over metrics
        log_success(f"Receiver connected from {Style.BOLD}{conn_id}{Style.RESET}")
        
        # Load guest list and serve immediately to this receiver
        guests = load_or_create_guest_list()
        try:
            await websocket.send(json.dumps(guests))
            log_info(f"Dispatched guest list array to receiver {Style.BOLD}{conn_id}{Style.RESET}")
        except Exception as e:
            log_alert(f"Failed to send guest list to receiver {conn_id}: {e}")
            
        report_connection_metrics()
        
        # Check if a specific guest name was requested in the connection URL query string
        target_name = None
        try:
            parsed_url = urlparse(actual_path)
            query_params = parse_qs(parsed_url.query)
            target_name_list = query_params.get("name")
            if target_name_list:
                target_name = unquote(target_name_list[0]).strip()
        except Exception as e:
            log_warning(f"Error parsing path query params: {e}")

        # Load and transmit the appropriate signature to the receiver upon connection
        sig_to_send = None
        if target_name:
            sig_to_send = get_signature_by_name(target_name)
            if sig_to_send:
                log_info(f"Retrieved saved signature for requested guest '{target_name}'")
            else:
                log_info(f"No saved signature found for requested guest '{target_name}'")
        else:
            sig_to_send = get_last_completed_signature()
            if sig_to_send:
                log_info(f"Retrieved last completed signature for generic receiver")

        if sig_to_send:
            try:
                await websocket.send(json.dumps({
                    "type": "load_signature",
                    "name": sig_to_send["name"],
                    "strokes": sig_to_send["strokes"]
                }))
                log_info(f"Dispatched signature '{sig_to_send['name']}' to receiver {Style.BOLD}{conn_id}{Style.RESET}")
            except Exception as e:
                log_alert(f"Failed to transmit signature to receiver {conn_id}: {e}")
        
        try:
            # Receivers generally just listen, but we wait for close or message
            async for _ in websocket:
                pass
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            receivers.remove(websocket)
            print() # print new line over metrics
            log_warning(f"Receiver disconnected: {Style.BOLD}{conn_id}{Style.RESET}")
            report_connection_metrics()
            
    elif "/admin" in actual_path:
        admins.add(websocket)
        print() # print new line over metrics
        log_success(f"Admin console connected from {Style.BOLD}{conn_id}{Style.RESET}")
        
        # Load and serve guest list immediately to admin
        guests = load_or_create_guest_list()
        try:
            await websocket.send(json.dumps(guests))
            log_info(f"Dispatched guest list array to admin {Style.BOLD}{conn_id}{Style.RESET}")
        except Exception as e:
            log_alert(f"Failed to send guest list to admin {conn_id}: {e}")
            
        report_connection_metrics()
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    m_type = data.get("type", "").upper()
                    m_name = data.get("name", "")
                    
                    if m_type == "UNLOCK":
                        log_info(f"Admin request: UNLOCK '{m_name}'")
                        set_guest_lock_status(m_name, False)
                        delete_signature_data(m_name)
                        await broadcast_guest_list()
                    elif m_type == "LOCK":
                        log_info(f"Admin request: LOCK '{m_name}'")
                        set_guest_lock_status(m_name, True)
                        await broadcast_guest_list()
                    elif m_type == "RESET_ALL":
                        log_info("Admin request: RESET ALL LOCKS")
                        reset_all_locks()
                        await broadcast_guest_list()
                    elif m_type == "ADD_GUEST":
                        log_info(f"Admin request: ADD GUEST '{m_name}'")
                        add_guest_to_csv(m_name)
                        await broadcast_guest_list()
                    elif m_type == "DELETE_GUEST":
                        log_info(f"Admin request: DELETE GUEST '{m_name}'")
                        delete_guest_from_csv(m_name)
                        delete_signature_data(m_name)
                        await broadcast_guest_list()
                except Exception as e:
                    log_alert(f"Error handling admin message: {e}")
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            admins.remove(websocket)
            print() # print new line over metrics
            log_warning(f"Admin disconnected: {Style.BOLD}{conn_id}{Style.RESET}")
            report_connection_metrics()
            
    else:
        clients.add(websocket)
        print() # print new line over metrics
        log_success(f"Signature Pad client connected from {Style.BOLD}{conn_id}{Style.RESET}")
        
        # Load guest list and serve immediately to this client
        guests = load_or_create_guest_list()
        try:
            await websocket.send(json.dumps(guests))
            log_info(f"Dispatched guest list array to {Style.BOLD}{conn_id}{Style.RESET}")
        except Exception as e:
            log_alert(f"Failed to send guest list to client {conn_id}: {e}")
            
        report_connection_metrics()
        
        try:
            async for message in websocket:
                # Log telemetry event details elegantly in terminal
                try:
                    data = json.loads(message)
                    m_type = data.get("type", "UNKNOWN").upper()
                    m_name = data.get("name", "N/A").upper()
                    
                    if m_type == "START":
                        print()
                        log_info(f"{Style.CYAN}[START]{Style.RESET} Signer: {Style.BOLD}{m_name}{Style.RESET} @ ({data.get('x', 0):.3f}, {data.get('y', 0):.3f})")
                    elif m_type == "END":
                        log_info(f"{Style.GREEN}[END]{Style.RESET}   Signer: {Style.BOLD}{m_name}{Style.RESET}")
                    elif m_type == "CLEAR":
                        print()
                        log_warning(f"{Style.RED}[CLEAR]{Style.RESET} Clear canvas request received")
                        delete_signature_data(data.get("name"))
                        await broadcast_guest_list()
                    elif m_type == "DONE":
                        print()
                        log_success(f"{Style.SUCCESS}[DONE]{Style.RESET}   Signer: {Style.BOLD}{m_name}{Style.RESET} signature completed.")
                        # Auto-lock guest name!
                        set_guest_lock_status(data.get("name"), True)
                        # Save signature data!
                        save_signature_data(data.get("name"), data.get("strokes"))
                        # Broadcast updated guest list in real time to everyone!
                        await broadcast_guest_list()
                except Exception as e:
                    # Non-JSON or corrupt packets
                    pass
                
                # Relay raw message to all connected receivers
                if receivers:
                    # Broadcast in parallel
                    await asyncio.gather(
                        *[r.send(message) for r in receivers], 
                        return_exceptions=True
                    )
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            clients.remove(websocket)
            print()
            log_warning(f"Client disconnected: {Style.BOLD}{conn_id}{Style.RESET}")
            report_connection_metrics()

def process_http_request(connection, request):
    upgrade = request.headers.get("Upgrade", "")
    if upgrade.lower() == "websocket":
        return None  # Standard websocket handshake, pass through
        
    # Standard HTTP GET file serving
    path = request.path
    # Strip query parameters if any (e.g. /receiver?name=John)
    if "?" in path:
        path = path.split("?")[0]
        
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Map paths to local files
    file_mapping = {
        "/": "index.html",
        "/index.html": "index.html",
        "/receiver": "receiver.html",
        "/receiver.html": "receiver.html",
        "/admin": "admin.html",
        "/admin.html": "admin.html",
        "/sketch.js": "sketch.js",
        "/umbra.svg": "umbra.svg",
        "/bg_ttd.png": "bg_ttd.png",
        "/guestlist.csv": "guestlist.csv"
    }
    
    if path.startswith("/signature/"):
        filename = path.split("/")[-1]
        if not filename.endswith(".json"):
            filename += ".json"
        
        current_dir = os.path.dirname(os.path.abspath(__file__))
        full_path = os.path.join(current_dir, "signatures", filename)
        if os.path.exists(full_path):
            try:
                with open(full_path, "rb") as f:
                    body = f.read()
                headers = Headers([
                    ("Content-Type", "application/json"),
                    ("Content-Length", str(len(body))),
                    ("Connection", "close"),
                    ("Access-Control-Allow-Origin", "*")
                ])
                log_info(f"{Style.CYAN}[HTTP]{Style.RESET} Served signature file {filename} to {connection.remote_address[0]}:{connection.remote_address[1]}")
                return Response(200, "OK", headers, body)
            except Exception as e:
                body = f"Error reading signature: {e}".encode("utf-8")
                headers = Headers([
                    ("Content-Type", "text/plain"),
                    ("Content-Length", str(len(body))),
                    ("Connection", "close")
                ])
                return Response(500, "Internal Server Error", headers, body)
        else:
            body = b"Signature Not Found"
            headers = Headers([
                ("Content-Type", "text/plain"),
                ("Content-Length", str(len(body))),
                ("Connection", "close")
            ])
            return Response(404, "Not Found", headers, body)

    if path == "/guestlist.txt":
        try:
            guests = load_or_create_guest_list()
            names_text = "\n".join([g["name"] for g in guests]) + "\n"
            body = names_text.encode("utf-8")
            headers = Headers([
                ("Content-Type", "text/plain"),
                ("Content-Length", str(len(body))),
                ("Connection", "close"),
                ("Access-Control-Allow-Origin", "*")
            ])
            log_info(f"{Style.CYAN}[HTTP]{Style.RESET} Served dynamic guestlist.txt to {connection.remote_address[0]}:{connection.remote_address[1]}")
            return Response(200, "OK", headers, body)
        except Exception as e:
            body = f"Error reading file: {e}".encode("utf-8")
            headers = Headers([
                ("Content-Type", "text/plain"),
                ("Content-Length", str(len(body))),
                ("Connection", "close")
            ])
            return Response(500, "Internal Server Error", headers, body)
            
    filename = file_mapping.get(path)
    if filename:
        full_path = os.path.join(current_dir, filename)
        if os.path.exists(full_path):
            content_type = "text/plain"
            if filename.endswith(".html"):
                content_type = "text/html"
            elif filename.endswith(".js"):
                content_type = "application/javascript"
            elif filename.endswith(".svg"):
                content_type = "image/svg+xml"
            elif filename.endswith(".png"):
                content_type = "image/png"
            elif filename.endswith(".csv"):
                content_type = "text/csv"
                
            try:
                with open(full_path, "rb") as f:
                    body = f.read()
                    
                headers = Headers([
                    ("Content-Type", content_type),
                    ("Content-Length", str(len(body))),
                    ("Connection", "close"),
                    ("Access-Control-Allow-Origin", "*")
                ])
                # Log successful http request
                log_info(f"{Style.CYAN}[HTTP]{Style.RESET} Served {filename} to {connection.remote_address[0]}:{connection.remote_address[1]}")
                return Response(200, "OK", headers, body)
            except Exception as e:
                body = f"Error reading file: {e}".encode("utf-8")
                headers = Headers([
                    ("Content-Type", "text/plain"),
                    ("Content-Length", str(len(body))),
                    ("Connection", "close")
                ])
                return Response(500, "Internal Server Error", headers, body)
                
    # Fallback to 404
    body = b"404 Not Found"
    headers = Headers([
        ("Content-Type", "text/plain"),
        ("Content-Length", str(len(body))),
        ("Connection", "close")
    ])
    return Response(404, "Not Found", headers, body)

async def main():
    # Setup ANSI support on Windows if needed
    if os.name == 'nt':
        os.system('color')
        
    local_ip = get_local_ip()
    
    # Parse port command line argument if provided
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            log_warning(f"Invalid port argument '{sys.argv[1]}'. Using default {DEFAULT_PORT}.")
            port = DEFAULT_PORT
    
    print("=" * 70)
    print(f" {Style.HEADER}FUTURISTIC BIOMETRIC TELEMETRY WEBSOCKET RELAY SERVER{Style.RESET}")
    print("=" * 70)
    print(f" Status:       {Style.GREEN}ONLINE{Style.RESET}")
    print(f" Local IP:     {Style.BOLD}{local_ip}{Style.RESET}")
    print(f" Port:         {Style.BOLD}{port}{Style.RESET}")
    print("-" * 70)
    print(f" {Style.BOLD}CONFIGURATION SETTINGS FOR THE CODE FILES:{Style.RESET}")
    print(f"   In {Style.YELLOW}index.html{Style.RESET} (Line 130):")
    print(f"     {Style.CYAN}const wsUrl = `ws://{local_ip}:{port}`;{Style.RESET}")
    print(f"   In {Style.YELLOW}receiver.html{Style.RESET} (Line 36):")
    print(f"     {Style.CYAN}const wsUrl = `ws://{local_ip}:{port}/receiver`;{Style.RESET}")
    print("=" * 70)
    
    # Pre-load or create guest list on boot
    load_or_create_guest_list()
    
    # Start server with bind conflict handler and automatic fallback
    try:
        async with websockets.serve(
            register_connection, 
            "0.0.0.0", 
            port, 
            process_request=process_http_request
        ):
            log_success(f"Relay Server listening on {Style.BOLD}0.0.0.0:{port}{Style.RESET}")
            report_connection_metrics()
            await asyncio.Future()
    except OSError as e:
        if e.errno == 10048:  # Address already in use
            print()
            log_alert(f"Port {port} is ALREADY IN USE! TouchDesigner.exe or another process is holding this port.")
            log_info("Please stop the other server, OR run this server on a different port using:")
            log_info(f"  {Style.CYAN}python server.py <custom_port>{Style.RESET}")
            print()
            
            fallback_port = 9981 if port == 9980 else port + 1
            log_warning(f"Attempting to automatically fall back to port {fallback_port}...")
            print("-" * 70)
            print(f" {Style.BOLD}UPDATED CONFIGURATION FOR FALLBACK PORT {fallback_port}:{Style.RESET}")
            print(f"   In {Style.YELLOW}index.html{Style.RESET} (Line 130):")
            print(f"     {Style.CYAN}const wsUrl = `ws://{local_ip}:{fallback_port}`;{Style.RESET}")
            print(f"   In {Style.YELLOW}receiver.html{Style.RESET} (Line 36):")
            print(f"     {Style.CYAN}const wsUrl = `ws://{local_ip}:{fallback_port}/receiver`;{Style.RESET}")
            print("=" * 70)
            
            try:
                async with websockets.serve(
                    register_connection, 
                    "0.0.0.0", 
                    fallback_port, 
                    process_request=process_http_request
                ):
                    log_success(f"Relay Server listening on fallback {Style.BOLD}0.0.0.0:{fallback_port}{Style.RESET}")
                    report_connection_metrics()
                    await asyncio.Future()
            except Exception as ex:
                log_alert(f"Failed to bind on fallback port {fallback_port}: {ex}")
                sys.exit(1)
        else:
            raise e

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print()
        log_warning("Relay server shut down by keyboard interrupt. Offline.")
        sys.exit(0)
