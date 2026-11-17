"""Offline tests: persistence, tool safety rails, and the agent loop against a fake client."""

from types import SimpleNamespace

import pytest

from aether.agent import Agent
from aether.store import Store
from aether.tools import build_tools


def tool(tools, name):
    return next(t for t in tools if t.name == name)


@pytest.fixture
def store(tmp_path):
    return Store(tmp_path / "db" / "aether.db")


def test_store_round_trips_messages_and_tasks(store):
    assert store.load_messages() == []
    store.save_messages([{"role": "user", "content": "hi"}])
    assert store.load_messages() == [{"role": "user", "content": "hi"}]

    task_id = store.add_task("Write tests", notes="pytest")
    assert store.update_task(task_id, status="doing")
    assert store.list_tasks() == [{"id": task_id, "title": "Write tests", "status": "doing", "notes": "pytest"}]
    assert store.update_task(task_id, status="done")
    assert store.list_tasks() == []
    assert store.list_tasks(include_done=True)[0]["status"] == "done"
    assert not store.update_task(999, status="done")
    with pytest.raises(ValueError):
        store.update_task(task_id, status="finished")


def test_file_tools_stay_inside_workdir(tmp_path, store):
    workdir = tmp_path / "work"
    workdir.mkdir()
    (workdir / "notes.txt").write_text("hello")
    tools = build_tools(workdir, store, approve=lambda *_: True)

    assert tool(tools, "read_file").call({"path": "notes.txt"}) == "hello"
    assert tool(tools, "list_directory").call({"path": "."}) == "notes.txt"
    with pytest.raises(ValueError):
        tool(tools, "read_file").call({"path": "../outside.txt"})
    with pytest.raises(ValueError):
        tool(tools, "write_file").call({"path": "/etc/passwd", "content": "x"})


def test_writes_and_shell_need_approval(tmp_path, store):
    asked = []

    def deny(tool_name, action):
        asked.append((tool_name, action))
        return False

    tools = build_tools(tmp_path, store, approve=deny)
    result = tool(tools, "write_file").call({"path": "sub/new.txt", "content": "data"})
    assert "declined" in result and not (tmp_path / "sub" / "new.txt").exists()
    result = tool(tools, "run_shell").call({"command": "echo hi"})
    assert "declined" in result
    assert asked == [
        ("write_file", "write 4 characters to " + str((tmp_path / "sub" / "new.txt").resolve())),
        ("run_shell", "run: echo hi"),
    ]

    tools = build_tools(tmp_path, store, approve=lambda *_: True)
    tool(tools, "write_file").call({"path": "sub/new.txt", "content": "data"})
    assert (tmp_path / "sub" / "new.txt").read_text() == "data"
    assert tool(tools, "run_shell").call({"command": "echo hi"}) == "exit code 0\nhi"


def test_tasks_tool_plans_and_updates(tmp_path, store):
    tasks = tool(build_tools(tmp_path, store, approve=lambda *_: True), "tasks")
    assert tasks.call({"action": "list"}) == "No open tasks."
    assert tasks.call({"action": "add", "title": "Read the repo"}) == "Added task #1: Read the repo"
    assert tasks.call({"action": "update", "task_id": 1, "status": "done", "notes": "found 3 bugs"}) == "Updated task #1"
    assert tasks.call({"action": "list"}) == "No open tasks."
    assert store.list_tasks(include_done=True)[0]["notes"] == "found 3 bugs"
    with pytest.raises(ValueError):
        tasks.call({"action": "add"})


# One model call: 1,000 fresh input tokens and 100 output tokens, no cache, no web search.
USAGE = SimpleNamespace(input_tokens=1000, output_tokens=100, cache_creation_input_tokens=0, cache_read_input_tokens=0, server_tool_use=None)


def fake_message(stop_reason, content):
    return SimpleNamespace(stop_reason=stop_reason, content=content, model=None, usage=USAGE)


class FakeStream:
    def __init__(self, text):
        self.text_stream = iter([text[:5], text[5:]])
        self.message = fake_message("end_turn", [SimpleNamespace(type="text", to_dict=lambda: {"type": "text", "text": text})])

    def get_final_message(self):
        return self.message


class FakeRunner:
    def __init__(self, params):
        self.params = params

    def __iter__(self):
        yield FakeStream("Hello there")

    def generate_tool_call_response(self):
        return None


class FakeClient:
    def __init__(self):
        self.last_params = None
        self.beta = SimpleNamespace(messages=SimpleNamespace(tool_runner=self.tool_runner))

    def tool_runner(self, **params):
        self.last_params = params
        return FakeRunner(params)


def test_agent_streams_persists_and_reloads(tmp_path):
    home = tmp_path / "home"
    client = FakeClient()
    agent = Agent(home=home, workdir=tmp_path, approve=lambda *_: True, client=client)
    chunks = []

    assert agent.run("hi", on_text=chunks.append) == "end_turn"
    assert "".join(chunks) == "Hello there"
    assert (home / "memories").is_dir()
    assert client.last_params["model"] == "claude-opus-5-5"
    assert client.last_params["stream"] is True
    tool_names = {t.get("name") if isinstance(t, dict) else t.name for t in client.last_params["tools"]}
    assert tool_names == {"memory", "list_directory", "read_file", "write_file", "run_shell", "tasks", "web_search", "web_fetch"}

    reloaded = Agent(home=home, workdir=tmp_path, approve=lambda *_: True, client=client)
    assert reloaded.messages == [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": [{"type": "text", "text": "Hello there"}]},
    ]
    reloaded.new_conversation()
    assert Agent(home=home, workdir=tmp_path, approve=lambda *_: True, client=client).messages == []


def test_agent_reports_tool_calls(tmp_path):
    """A turn with a tool call emits tool_start before and tool_end after the tool runs."""
    call = SimpleNamespace(type="tool_use", id="toolu_1", name="read_file", input={"path": "a.txt"},
                           to_dict=lambda: {"type": "tool_use", "id": "toolu_1", "name": "read_file", "input": {"path": "a.txt"}})

    class ToolStream(FakeStream):
        def __init__(self):
            super().__init__("")
            self.message = fake_message("tool_use", [call])

    class ToolRunner(FakeRunner):
        answered = False

        def __iter__(self):
            yield ToolStream()
            yield FakeStream("Hello there")

        def generate_tool_call_response(self):
            if self.answered:
                return None
            self.answered = True
            return {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "toolu_1", "content": "hello"}]}

    client = FakeClient()
    client.tool_runner = lambda **params: ToolRunner(params)
    client.beta.messages.tool_runner = client.tool_runner
    agent = Agent(home=tmp_path / "home", workdir=tmp_path, approve=lambda *_: True, client=client)
    events = []
    agent.run("read a.txt", on_text=lambda _: None, on_event=lambda kind, payload: events.append((kind, payload)))
    assert events == [
        ("tool_start", {"id": "toolu_1", "name": "read_file", "input": {"path": "a.txt"}}),
        ("tool_end", {"id": "toolu_1", "name": "read_file", "result": "hello", "is_error": False}),
    ]
    assert [m["role"] for m in agent.messages] == ["user", "assistant", "user", "assistant"]
