"""Accès à PocketBase avec le jeton de l'utilisatrice : le worker ne voit
que ce qu'elle a le droit de voir."""

import httpx


class PBError(RuntimeError):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


class PocketBase:
    def __init__(self, base_url: str, token: str, client: httpx.AsyncClient | None = None) -> None:
        self.base = base_url.rstrip("/")
        self.token = token
        self.client = client or httpx.AsyncClient(timeout=15)

    async def _get(self, path: str, params: dict | None = None) -> dict:
        r = await self.client.get(
            f"{self.base}{path}", params=params, headers={"Authorization": self.token}
        )
        if r.status_code != 200:
            raise PBError(r.status_code, f"PocketBase {path}: {r.status_code}")
        return r.json()

    async def verifier_session(self) -> dict:
        r = await self.client.post(
            f"{self.base}/api/collections/users/auth-refresh",
            headers={"Authorization": self.token},
        )
        if r.status_code != 200:
            raise PBError(401, "Session invalide")
        return r.json()["record"]

    async def record(self, collection: str, id: str, expand: str | None = None) -> dict:
        params = {"expand": expand} if expand else None
        return await self._get(f"/api/collections/{collection}/records/{id}", params)

    async def liste(self, collection: str, filtre: str, tri: str = "-created", n: int = 50) -> list[dict]:
        data = await self._get(
            f"/api/collections/{collection}/records",
            {"filter": filtre, "sort": tri, "perPage": n},
        )
        return data["items"]
