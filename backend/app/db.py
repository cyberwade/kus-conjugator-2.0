import os
from contextlib import contextmanager
from typing import Iterator

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv


load_dotenv()


def _get_db_dsn() -> str:
    host = os.getenv("DB_HOST", "")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "loryit_kus_conj")
    user = os.getenv("DB_USER", "")
    password = os.getenv("DB_PASSWORD", "")
    return f"dbname={name} user={user} password={password} host={host} port={port}"


@contextmanager
def get_db_cursor() -> Iterator[RealDictCursor]:
    """
    Context manager that yields a RealDictCursor and closes connection afterwards.
    Intended for short, simple SELECT queries as in this training app.
    """
    conn = psycopg2.connect(_get_db_dsn(), cursor_factory=RealDictCursor)
    try:
        with conn.cursor() as cur:
            yield cur
    finally:
        conn.close()

