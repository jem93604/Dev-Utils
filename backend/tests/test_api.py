"""CRUD + regression coverage for the v1 API.

Regression focus: every UUID path param must accept canonical UUID strings
(str IDs used to 500 on SQLite) and reject garbage with 422, never 500.
"""
from conftest import new_uuid


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_sections_crud(client):
    created = client.post("/api/v1/sections", json={"name": "S1"}).json()
    assert created["slug"] == "s1"
    assert created["query_count"] == 0

    listed = client.get("/api/v1/sections").json()
    assert any(s["id"] == created["id"] for s in listed)

    updated = client.patch(
        f"/api/v1/sections/{created['id']}", json={"description": "new"}
    ).json()
    assert updated["description"] == "new"

    assert client.delete(f"/api/v1/sections/{created['id']}").json() == {"ok": True}
    assert all(s["id"] != created["id"] for s in client.get("/api/v1/sections").json())


def test_sections_invalid_uuid_is_422_not_500(client):
    assert client.get("/api/v1/sections/not-a-uuid/queries").status_code == 422
    assert client.patch("/api/v1/sections/not-a-uuid", json={}).status_code == 422
    assert client.delete("/api/v1/sections/not-a-uuid").status_code == 422


def test_sections_missing_is_404(client):
    assert client.patch(f"/api/v1/sections/{new_uuid()}", json={}).status_code == 404
    assert client.delete(f"/api/v1/sections/{new_uuid()}").status_code == 404


def test_queries_crud_and_variables(client, section):
    r = client.post(
        "/api/v1/queries",
        json={
            "section_id": section["id"],
            "title": "Q1",
            "sql_text": "SELECT * FROM t WHERE x = '{{v}}' AND y = '{{v}}'",
        },
    )
    assert r.status_code == 200, r.text
    q = r.json()
    assert q["variables"] == ["v"]

    # creating a query auto-registers its {{variables}} as inputs
    inputs = {i["key"] for i in client.get("/api/v1/inputs").json()}
    assert "v" in inputs

    got = client.get(f"/api/v1/queries/{q['id']}").json()
    assert got["title"] == "Q1" and got["pinned"] is False

    patched = client.patch(f"/api/v1/queries/{q['id']}", json={"title": "Q2"}).json()
    assert patched["title"] == "Q2"

    assert client.delete(f"/api/v1/queries/{q['id']}").json() == {"ok": True}
    assert client.get(f"/api/v1/queries/{q['id']}").status_code == 404


def test_queries_invalid_uuid_is_422_not_500(client):
    assert client.get("/api/v1/queries/nope").status_code == 422
    assert client.patch("/api/v1/queries/nope", json={}).status_code == 422
    assert client.delete("/api/v1/queries/nope").status_code == 422


def test_queries_require_title_and_sql(client, section):
    r = client.post(
        "/api/v1/queries",
        json={"section_id": section["id"], "title": " ", "sql_text": "SELECT 1"},
    )
    assert r.status_code == 422


def test_pins_roundtrip(client, section):
    q = client.post(
        "/api/v1/queries",
        json={"section_id": section["id"], "title": "P", "sql_text": "SELECT 1"},
    ).json()
    assert client.get("/api/v1/pins").json() == []

    assert client.put(f"/api/v1/pins/{q['id']}").json() == {"ok": True, "pinned": True}
    pins = client.get("/api/v1/pins").json()
    assert [p["id"] for p in pins] == [q["id"]]
    assert pins[0]["pinned"] is True

    assert client.delete(f"/api/v1/pins/{q['id']}").json() == {"ok": True, "pinned": False}
    assert client.get("/api/v1/pins").json() == []


def test_notes_crud(client):
    n = client.post("/api/v1/notes", json={"title": "N", "content": "c"}).json()
    assert n["title"] == "N"

    assert len(client.get("/api/v1/notes").json()) == 1

    u = client.patch(f"/api/v1/notes/{n['id']}", json={"title": "N2", "content": "c2"}).json()
    assert u["title"] == "N2"

    assert client.delete(f"/api/v1/notes/{n['id']}").json() == {"ok": True}
    assert client.get("/api/v1/notes").json() == []


def test_scripts_crud(client):
    payload = {"file_name": "a.sh", "path": "/x", "remark": "r", "purpose": "p", "steps": "1"}
    s = client.post("/api/v1/scripts", json=payload).json()
    assert s["file_name"] == "a.sh"

    u = client.patch(f"/api/v1/scripts/{s['id']}", json={**payload, "file_name": "b.sh"}).json()
    assert u["file_name"] == "b.sh"

    assert client.delete(f"/api/v1/scripts/{s['id']}").json() == {"ok": True}
    assert client.get("/api/v1/scripts").json() == []


def test_stats_counts(client, section):
    assert client.get("/api/v1/stats").json() == {
        "sections": 1, "queries": 0, "pinned": 0, "notes": 0, "scripts": 0,
    }
    q = client.post(
        "/api/v1/queries",
        json={"section_id": section["id"], "title": "Q", "sql_text": "SELECT 1"},
    ).json()
    client.put(f"/api/v1/pins/{q['id']}")
    client.post("/api/v1/notes", json={"title": "N", "content": ""})
    stats = client.get("/api/v1/stats").json()
    assert (stats["queries"], stats["pinned"], stats["notes"]) == (1, 1, 1)


def test_versions_snapshot_and_list(client, section):
    v = client.post("/api/v1/versions", json={"remark": "snap"}).json()
    assert v["remark"] == "snap"
    versions = client.get("/api/v1/versions").json()
    assert len(versions) == 1

    # restore wipes current content and re-imports the snapshot
    client.post("/api/v1/queries", json={"section_id": section["id"], "title": "extra", "sql_text": "SELECT 2"})
    assert client.post(f"/api/v1/versions/{v['id']}/restore").json() == {"ok": True}
    assert client.get("/api/v1/stats").json()["queries"] == 0


def test_search(client, section):
    client.post(
        "/api/v1/queries",
        json={"section_id": section["id"], "title": "Unicorn lookup", "sql_text": "SELECT 1"},
    )
    r = client.get("/api/v1/search", params={"q": "unicorn"}).json()
    assert len(r["queries"]) == 1
    assert client.get("/api/v1/search", params={"q": "zzz-no-match"}).json()["queries"] == []


def _mk_note(client, title):
    r = client.post("/api/v1/notes", json={"title": title, "content": ""})
    assert r.status_code == 200, r.text
    return r.json()


def test_notes_default_order_is_newest_first(client):
    a = _mk_note(client, "first")
    b = _mk_note(client, "second")
    titles = [n["title"] for n in client.get("/api/v1/notes").json()]
    assert titles == ["second", "first"]
    assert a["sort_order"] > b["sort_order"]  # newest sorts first in custom mode


def test_notes_sort_param(client):
    _mk_note(client, "one")
    _mk_note(client, "two")
    assert [n["title"] for n in client.get("/api/v1/notes", params={"sort": "created"}).json()] == ["two", "one"]
    assert [n["title"] for n in client.get("/api/v1/notes", params={"sort": "custom"}).json()] == ["two", "one"]
    assert client.get("/api/v1/notes", params={"sort": "bogus"}).status_code == 422


def test_notes_reorder_persists_custom_order(client):
    a = _mk_note(client, "A")
    b = _mk_note(client, "B")
    c = _mk_note(client, "C")
    r = client.put("/api/v1/notes/reorder", json={"ids": [c["id"], a["id"], b["id"]]})
    assert r.json() == {"ok": True}
    titles = [n["title"] for n in client.get("/api/v1/notes", params={"sort": "custom"}).json()]
    assert titles == ["C", "A", "B"]
    # unknown ids are ignored, not errors
    assert client.put("/api/v1/notes/reorder", json={"ids": [b["id"], "00000000-0000-0000-0000-000000000000"]}).json() == {"ok": True}
    titles = [n["title"] for n in client.get("/api/v1/notes", params={"sort": "custom"}).json()]
    assert titles[0] == "B"
