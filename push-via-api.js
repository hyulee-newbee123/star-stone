const { execFileSync } = require("child_process");

const GH = "C:\\Program Files\\GitHub CLI\\gh.exe";
const REPO = "/repos/hyulee-newbee123/star-stone";

function git(args, enc = "utf8") {
  return execFileSync("git", args, { encoding: enc, maxBuffer: 20 * 1024 * 1024 });
}

function ghApi(method, path, body) {
  const args = ["api", "-X", method, path];
  if (body) args.push("--input", "-");
  const out = execFileSync(GH, args, {
    input: body ? JSON.stringify(body) : undefined,
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
  return JSON.parse(out);
}

function iso(commit, field) {
  return git(["show", "-s", `--format=${field}`, commit]).trim();
}

const remote = ghApi("GET", `${REPO}/git/ref/heads/master`).object.sha;
const head = git(["rev-parse", "HEAD"]).trim();
if (remote === head) {
  console.log("GitHub 已是最新：", head);
  process.exit(0);
}

const commits = git(["rev-list", "--reverse", `${remote}..${head}`])
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);
if (!commits.length) {
  console.log("本地没有需要推送的提交（或历史不一致）。");
  process.exit(1);
}

let parent = remote;
for (const sha of commits) {
  const files = git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const items = files.map((path) => {
    const exists = git(["ls-tree", sha, path]).trim();
    if (!exists) return { path, mode: "100644", type: "blob", sha: null };
    const content = git(["cat-file", "blob", `${sha}:${path}`], "buffer");
    const blob = ghApi("POST", `${REPO}/git/blobs`, {
      content: Buffer.from(content).toString("base64"),
      encoding: "base64",
    });
    return { path, mode: exists.split(" ")[0], type: "blob", sha: blob.sha };
  });
  const parentTree = git(["rev-parse", `${parent}^{tree}`]).trim();
  const tree = ghApi("POST", `${REPO}/git/trees`, { base_tree: parentTree, tree: items });
  const commit = ghApi("POST", `${REPO}/git/commits`, {
    message: iso(sha, "%B"),
    tree: tree.sha,
    parents: [parent],
    author: { name: iso(sha, "%an"), email: iso(sha, "%ae"), date: iso(sha, "%aI") },
    committer: { name: iso(sha, "%cn"), email: iso(sha, "%ce"), date: iso(sha, "%cI") },
  });
  ghApi("PATCH", `${REPO}/git/refs/heads/master`, { sha: commit.sha });
  parent = commit.sha;
  console.log("已推送", sha.slice(0, 7), iso(sha, "%s"));
}
console.log("完成", parent);
