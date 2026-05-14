"""
Seeder script for creating an admin user.

Usage:
    python seed_admin.py \
        --firstname John \
        --lastname Doe \
        --contact 09171234567 \
        --email admin@example.com \
        --password secretpassword

Run from the backend/ directory with the venv active.
"""

import argparse
import hashlib
import os
import secrets
import sys

from dotenv import load_dotenv

load_dotenv()

from database import SessionLocal
from models import Users, Admin


def hash_password(plain: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 260_000)
    return f"pbkdf2:sha256:260000${salt}${dk.hex()}"


def seed_admin(firstname: str, lastname: str, contact: str, email: str, password: str):
    db = SessionLocal()
    try:
        existing = db.query(Users).filter(Users.user_email == email).first()
        if existing:
            print(f"[!] A user with email '{email}' already exists (user_id={existing.user_id}). Aborting.")
            sys.exit(1)

        user = Users(
            user_email=email,
            user_password=hash_password(password),
            user_role="admin",
        )
        db.add(user)
        db.flush()  # get user_id before committing

        admin = Admin(
            admin_firstname=firstname,
            admin_lastname=lastname,
            admin_contact=contact,
            user_id=user.user_id,
        )
        db.add(admin)
        db.commit()
        db.refresh(user)
        db.refresh(admin)

        print(f"[+] Admin created successfully.")
        print(f"    user_id  : {user.user_id}")
        print(f"    admin_id : {admin.admin_id}")
        print(f"    email    : {user.user_email}")
        print(f"    name     : {admin.admin_firstname} {admin.admin_lastname}")
        print(f"    contact  : {admin.admin_contact}")
        print(f"    role     : {user.user_role}")

    except Exception as exc:
        db.rollback()
        print(f"[!] Error: {exc}")
        sys.exit(1)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Seed an admin account into the database.")
    parser.add_argument("--firstname", required=True, help="Admin first name")
    parser.add_argument("--lastname",  required=True, help="Admin last name")
    parser.add_argument("--contact",   required=True, help="Admin contact number")
    parser.add_argument("--email",     required=True, help="Login email")
    parser.add_argument("--password",  required=True, help="Login password (will be hashed)")
    args = parser.parse_args()

    seed_admin(
        firstname=args.firstname,
        lastname=args.lastname,
        contact=args.contact,
        email=args.email,
        password=args.password,
    )


if __name__ == "__main__":
    main()
