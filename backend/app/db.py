import psycopg2
from app.config import DATABASE_URL

def get_connection():
    """
    Opens a new connection to the Supabase Postgres database using Transaction Pooler.
    """
    conn = psycopg2.connect(
        DATABASE_URL,
        sslmode="require",
        prepare_threshold=None  # Disables prepared statements for transaction pooling
    )
    return conn