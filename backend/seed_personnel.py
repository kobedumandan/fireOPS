"""
Seeder script for creating a personnel user.

Usage:
    python seed_personnel.py \
        --firstname Juan \
        --lastname Dela Cruz \
        --contact 09171234567 \
        --rank "Fire Officer I" \
        --designation "Driver" \
        --email personnel@example.com \
        --password secretpassword

Run from the backend/ directory with the venv active.
"""

import argparse
import hashlib
import secrets
import sys

from dotenv import load_dotenv

load_dotenv()

from database import SessionLocal
from models import Users, Personnel


def hash_password(plain: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 260_000)
    return f"pbkdf2:sha256:260000${salt}${dk.hex()}"


def seed_personnel(
    firstname: str,
    lastname: str,
    contact: str,
    rank: str,
    designation: str,
    email: str,
    password: str,
):
    db = SessionLocal()
    try:
        existing = db.query(Users).filter(Users.user_email == email).first()
        if existing:
            print(f"[!] A user with email '{email}' already exists (user_id={existing.user_id}). Aborting.")
            sys.exit(1)

        user = Users(
            user_email=email,
            user_password=hash_password(password),
            user_role="personnel",
        )
        db.add(user)
        db.flush()

        personnel = Personnel(
            per_firstname=firstname,
            per_lastname=lastname,
            per_contact=contact,
            per_rank=rank,
            per_designation=designation,
            user_id=user.user_id,
        )
        db.add(personnel)
        db.commit()
        db.refresh(user)
        db.refresh(personnel)

        print(f"[+] Personnel created successfully.")
        print(f"    user_id    : {user.user_id}")
        print(f"    per_id     : {personnel.per_id}")
        print(f"    email      : {user.user_email}")
        print(f"    name       : {personnel.per_firstname} {personnel.per_lastname}")
        print(f"    contact    : {personnel.per_contact}")
        print(f"    rank       : {personnel.per_rank}")
        print(f"    designation: {personnel.per_designation}")
        print(f"    role       : {user.user_role}")

    except Exception as exc:
        db.rollback()
        print(f"[!] Error: {exc}")
        sys.exit(1)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Seed a personnel account into the database.")
    parser.add_argument("--firstname",   required=True, help="First name")
    parser.add_argument("--lastname",    required=True, help="Last name")
    parser.add_argument("--contact",     required=True, help="Contact number")
    parser.add_argument("--rank",        required=True, help="Rank (e.g. 'Fire Officer I')")
    parser.add_argument("--designation", required=True, help="Designation (e.g. 'Driver')")
    parser.add_argument("--email",       required=True, help="Login email")
    parser.add_argument("--password",    required=True, help="Login password (will be hashed)")
    args = parser.parse_args()

    seed_personnel(
        firstname=args.firstname,
        lastname=args.lastname,
        contact=args.contact,
        rank=args.rank,
        designation=args.designation,
        email=args.email,
        password=args.password,
    )


if __name__ == "__main__":
    main()
