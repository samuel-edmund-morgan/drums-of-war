#!/usr/bin/env python3
"""
Set CMaNGOS WotLK account password (SRP6 auth).
Usage: python3 set_password.py USERNAME PASSWORD
Outputs SQL to update the account.
"""
import hashlib
import os
import sys

def compute_srp6(username, password):
    """Compute SRP6 verifier (v) and salt (s) for CMaNGOS."""
    username = username.upper()
    password = password.upper()
    
    # Generate random salt (32 bytes)
    salt = os.urandom(32)
    
    # x = SHA1(salt | SHA1(username:password))
    credentials_hash = hashlib.sha1(f"{username}:{password}".encode()).digest()
    x_hash = hashlib.sha1(salt + credentials_hash).digest()
    x = int.from_bytes(x_hash, 'little')
    
    # SRP6 generator and prime
    g = 7
    N = int("894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7", 16)
    
    # v = g^x mod N
    v = pow(g, x, N)
    
    # Convert to hex strings (reversed byte order for CMaNGOS)
    v_bytes = v.to_bytes(32, 'little')
    s_bytes = salt  # already in correct order
    
    v_hex = v_bytes.hex().upper()
    s_hex = s_bytes.hex().upper()
    
    return v_hex, s_hex

if __name__ == '__main__':
    username = sys.argv[1] if len(sys.argv) > 1 else "ADMIN"
    password = sys.argv[2] if len(sys.argv) > 2 else "admin"
    
    v_hex, s_hex = compute_srp6(username, password)
    
    sql = f"UPDATE account SET v='{v_hex}', s='{s_hex}' WHERE username='{username.upper()}';"
    print(sql)
