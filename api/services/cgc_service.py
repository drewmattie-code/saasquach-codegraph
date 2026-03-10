from __future__ import annotations

import asyncio
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any

from codegraphcontext.core import get_database_manager
from codegraphcontext.core.jobs import JobManager
from codegraphcontext.tools.code_finder import CodeFinder
from codegraphcontext.tools.graph_builder import GraphBuilder
from codegraphcontext.tools.handlers.indexing_handlers import add_code_to_graph


class CGCService:
    def __init__(self) -> None:
        self.db_manager = get_database_manager()
        self.job_manager = JobManager()
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
        self.graph_builder = GraphBuilder(self.db_manager, self.job_manager, self.loop)
        self.code_finder = CodeFinder(self.db_manager)

    def _run_query(self, query: str, **params: Any) -> list[dict[str, Any]]:
        with self.db_manager.get_driver().session() as session:
            result = session.run(query, **params)
            return [dict(record) for record in result]

    def stats(self) -> dict[str, int]:
        rows = self._run_query(
            """
            CALL {
              MATCH (r:Repository)
              RETURN count(r) as repositories
            }
            CALL {
              MATCH (f:File)
              RETURN count(f) as files
            }
            CALL {
              MATCH (func:Function)
              RETURN count(func) as functions
            }
            CALL {
              MATCH (cls:Class)
              RETURN count(cls) as classes
            }
            RETURN repositories, files, functions, classes
            """
        )
        return rows[0] if rows else {"repositories": 0, "files": 0, "functions": 0, "classes": 0}

    def list_repos(self) -> list[dict[str, Any]]:
        repos = self.code_finder.list_indexed_repositories()
        for repo in repos:
            repo["stats"] = self.repo_stats(repo["name"])
        return repos

    def index_repo(self, path: str) -> dict[str, Any]:
        payload = add_code_to_graph(
            self.graph_builder,
            self.job_manager,
            self.loop,
            lambda **_: {"repositories": self.code_finder.list_indexed_repositories()},
            path=path,
            is_dependency=False,
        )
        return payload

    def remove_repo(self, repo_name: str) -> dict[str, Any]:
        repos = self.code_finder.list_indexed_repositories()
        target = next((r for r in repos if r["name"] == repo_name), None)
        if not target:
            return {"success": False, "message": "Repository not found"}
        success = self.graph_builder.delete_repository_from_graph(target["path"])
        return {"success": success}

    def repo_stats(self, repo_name: str) -> dict[str, Any]:
        rows = self._run_query(
            """
            MATCH (r:Repository {name:$name})-[:CONTAINS*]->(f:File)
            OPTIONAL MATCH (f)-[:CONTAINS]->(func:Function)
            OPTIONAL MATCH (f)-[:CONTAINS]->(cls:Class)
            RETURN count(DISTINCT f) AS files,
                   count(DISTINCT func) AS functions,
                   count(DISTINCT cls) AS classes
            """,
            name=repo_name,
        )
        return rows[0] if rows else {"files": 0, "functions": 0, "classes": 0}

    def graph(self, repo: str | None = None, limit: int = 500) -> dict[str, list[dict[str, Any]]]:
        where = "WHERE true"
        params: dict[str, Any] = {"limit": limit}
        if repo and repo != "all":
            where = "WHERE repo.name = $repo"
            params["repo"] = repo
        nodes = self._run_query(
            f"""
            MATCH (repo:Repository)-[:CONTAINS*]->(n)
            {where} AND (n:Function OR n:Class OR n:File)
            RETURN DISTINCT id(n) as id, n.name as name, labels(n)[0] as type,
                   n.path as path, n.line_number as line
            LIMIT $limit
            """,
            **params,
        )
        edges = self._run_query(
            f"""
            MATCH (repo:Repository)-[:CONTAINS*]->(a)-[r:CALLS|INHERITS|IMPORTS]->(b)
            {where}
            RETURN id(r) as id, id(a) as source, id(b) as target, type(r) as kind
            LIMIT $limit
            """,
            **params,
        )
        return {"nodes": nodes, "edges": edges}

    def node_detail(self, node_id: int) -> dict[str, Any]:
        rows = self._run_query(
            """
            MATCH (n)
            WHERE id(n) = $node_id
            OPTIONAL MATCH (caller)-[:CALLS]->(n)
            OPTIONAL MATCH (n)-[:CALLS]->(callee)
            RETURN id(n) as id, n.name as name, labels(n)[0] as type, n.path as path,
                   n.line_number as line, n.source as source,
                   collect(DISTINCT caller.name)[0..20] as callers,
                   collect(DISTINCT callee.name)[0..20] as callees
            """,
            node_id=node_id,
        )
        return rows[0] if rows else {}

    def search(self, q: str, type_: str = "all", repo: str | None = None) -> list[dict[str, Any]]:
        del repo
        fuzzy = True
        if type_.lower() == "functions":
            return self.code_finder.find_by_function_name(q, fuzzy)
        if type_.lower() == "classes":
            return self.code_finder.find_by_class_name(q, fuzzy)
        if type_.lower() == "content":
            return self.code_finder.find_by_content(q)
        if type_.lower() == "modules":
            return self.code_finder.find_by_module_name(q)
        results = self.code_finder.find_related_code(q, fuzzy_search=True, edit_distance=2)
        return results.get("ranked_results", [])

    def dead_code(self) -> dict[str, Any]:
        return self.code_finder.find_dead_code()

    def complexity(self) -> list[dict[str, Any]]:
        return self.code_finder.find_most_complex_functions(20)

    def calls(self, name: str) -> list[dict[str, Any]]:
        return self.code_finder.what_does_function_call(name)

    def callers(self, name: str) -> list[dict[str, Any]]:
        return self.code_finder.who_calls_function(name)

    def chain(self, from_function: str, to_function: str) -> list[dict[str, Any]]:
        return self.code_finder.find_function_call_chain(from_function, to_function, 8)

    def jobs(self) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for job in self.job_manager.list_jobs():
            payload = asdict(job)
            payload["status"] = job.status.value
            payload["start_time"] = job.start_time.isoformat()
            payload["end_time"] = job.end_time.isoformat() if isinstance(job.end_time, datetime) else None
            items.append(payload)
        return items


cgc_service = CGCService()
