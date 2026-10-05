"""Verify a running development API without printing tokens or database credentials."""

import argparse

import httpx

from app.db.seed import DEMO_PASSWORD


def verify_role_views(client: httpx.Client, role: str, headers: dict) -> None:
    if role == "school_admin":
        client.get("/api/v1/admin/imports", headers=headers).raise_for_status()
    elif role == "student":
        for resource in ("dashboard", "progress", "interventions", "goals"):
            response = client.get(f"/api/v1/student/me/{resource}", headers=headers)
            response.raise_for_status()
            for field in ('"risk_probability"', '"at_risk"', '"severity"', '"note"'):
                assert field not in response.text
        assert client.get("/api/v1/admin/imports", headers=headers).status_code == 403
    else:
        courses = client.get("/api/v1/teacher/classes", headers=headers)
        courses.raise_for_status()
        assert courses.json(), "The demo seed should have an assigned course"
        course_id = courses.json()[0]["id"]
        client.get(
            f"/api/v1/teacher/classes/{course_id}/risk-summary", headers=headers
        ).raise_for_status()
        students = client.get(f"/api/v1/teacher/classes/{course_id}/students", headers=headers)
        students.raise_for_status()
        if students.json():
            student_id = students.json()[0]["id"]
            client.get(
                f"/api/v1/teacher/students/{student_id}/progress",
                headers=headers,
                params={"course_offering_id": course_id},
            ).raise_for_status()
    print(f"{role}: dashboard/progress/import-report role checks passed")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    with httpx.Client(base_url=args.url, timeout=30) as client:
        for path in ("/health", "/ready", "/docs", "/openapi.json"):
            response = client.get(path)
            response.raise_for_status()
            print(f"GET {path}: {response.status_code}")
        for name, role in [
            ("admin", "school_admin"),
            ("teacher", "teacher"),
            ("student", "student"),
        ]:
            response = client.post(
                "/api/v1/auth/login",
                json={
                    "school_slug": "demo",
                    "email": f"{name}@demo.edu",
                    "password": DEMO_PASSWORD,
                },
            )
            response.raise_for_status()
            tokens = response.json()
            headers = {"Authorization": f"Bearer {tokens['access_token']}"}
            me = client.get("/api/v1/auth/me", headers=headers)
            me.raise_for_status()
            assert me.json()["role"] == role
            verify_role_views(client, role, headers)
            refreshed = client.post(
                "/api/v1/auth/refresh",
                json={
                    "refresh_token": tokens["refresh_token"],
                },
            )
            refreshed.raise_for_status()
            logout = client.post(
                "/api/v1/auth/logout",
                json={
                    "refresh_token": refreshed.json()["refresh_token"],
                },
            )
            assert logout.status_code == 204
            assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
            print(f"{role}: login, me, refresh, logout, access revocation passed")


if __name__ == "__main__":
    main()
