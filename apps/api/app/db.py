"""Thin manual query layer on top of psycopg2. No ORM by design (subject constraint)."""
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
import psycopg2.pool
from flask import current_app, g

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def init_pool(app):
    global _pool
    _pool = psycopg2.pool.ThreadedConnectionPool(1, 20, dsn=app.config["DATABASE_URL"])
    app.teardown_appcontext(_release_conn)


def _release_conn(_exc):
    conn = g.pop("db_conn", None)
    if conn is not None:
        _pool.putconn(conn)


def get_conn():
    if "db_conn" not in g:
        g.db_conn = _pool.getconn()
    return g.db_conn


@contextmanager
def cursor(commit: bool = False):
    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def query_all(sql: str, params: tuple = ()) -> list[dict]:
    with cursor() as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def query_one(sql: str, params: tuple = ()) -> dict | None:
    with cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None


def execute(sql: str, params: tuple = ()) -> None:
    with cursor(commit=True) as cur:
        cur.execute(sql, params)


def execute_returning(sql: str, params: tuple = ()) -> dict | None:
    with cursor(commit=True) as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None
