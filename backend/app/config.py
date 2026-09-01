import os
from dotenv import load_dotenv

load_dotenv()  # reads the .env file and loads its values into the environment

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL is None:
    raise RuntimeError(
        "DATABASE_URL is not set. Did you create a .env file with your Supabase connection string?"
    )