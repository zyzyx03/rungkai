// The example catalogue: one group per category, each with the line that
// describes it and a plain-language label for every command in it. Shared by
// the page (which renders every group's panel) and the client (which switches
// between them).
export const SAMPLE_GROUPS = [
  {
    id: "ssh",
    tab: "SSH",
    glyph: "terminal",
    desc: "Secure connections and file transfers",
    commands: [
      { label: "Forward a local port", cmd: "ssh -i keyfile -f -N -L 1234:www.google.com:80 host" },
      { label: "Generate an SSH key", cmd: 'ssh-keygen -t ed25519 -C "you@example.com"' },
      { label: "Copy a folder to a server", cmd: "scp -r ./site user@host:/var/www" },
    ],
  },
  {
    id: "docker",
    tab: "Docker",
    glyph: "docker",
    desc: "Run and inspect containers",
    commands: [
      { label: "Start a container in the background", cmd: "docker run -d -p 8080:80 nginx" },
      { label: "List every container", cmd: "docker ps -a --format '{{.Names}}'" },
      { label: "Follow a container's logs", cmd: "docker logs -f --tail 100 api" },
    ],
  },
  {
    id: "git",
    tab: "Git",
    glyph: "git",
    desc: "History, diffs and commits",
    commands: [
      { label: "Graph a branch's commits", cmd: "git log --graph --abbrev-commit --pretty=oneline origin..mybranch" },
      { label: "Summarise what changed", cmd: "git diff --stat HEAD~1" },
      { label: "Commit every tracked change", cmd: 'git commit -am "message"' },
    ],
  },
  {
    id: "systemd",
    tab: "Systemd",
    glyph: "gear",
    desc: "Services, their logs and their restarts",
    commands: [
      { label: "Check a service's status", cmd: "systemctl status nginx --no-pager" },
      { label: "Follow a unit's logs", cmd: "journalctl -u nginx -f --since today" },
      { label: "Restart a service", cmd: "systemctl restart nginx" },
    ],
  },
  {
    id: "networking",
    tab: "Networking",
    glyph: "network",
    desc: "Sockets, addresses and routes",
    commands: [
      { label: "Listening TCP sockets", cmd: "ss -tlnp | sort -k4" },
      { label: "Socket summary", cmd: "ss -s" },
      { label: "Addresses per interface", cmd: "ip -br addr" },
    ],
  },
  {
    id: "files",
    tab: "Files",
    glyph: "search",
    desc: "Find, measure and prune files",
    commands: [
      { label: "Delete logs older than 30 days", cmd: "find /var/log -type f -name '*.log' -mtime +30 -exec rm -rf {} +" },
      { label: "Find files over 100M", cmd: "find . -type f -size +100M -print0 | xargs -0 du -h" },
      { label: "Size a directory", cmd: "du -sh /var/log/* | sort -h" },
    ],
  },
  {
    id: "tar",
    tab: "Tar",
    glyph: "archive",
    desc: "Pack, list and unpack archives",
    commands: [
      { label: "Stream a directory to a server", cmd: 'tar zcf - some-dir | ssh some-server "cd /; tar xvzf -"' },
      { label: "Extract into a directory", cmd: "tar xzf backup.tar.gz -C /opt" },
      { label: "List an archive's contents", cmd: "tar tzf backup.tar.gz | head" },
    ],
  },
  {
    id: "shell",
    tab: "Shell",
    glyph: "prompt",
    desc: "Shell syntax: loops, substitution and expansion",
    commands: [
      { label: "Build a user@host string", cmd: 'name=$(printf "%s@%s" "$(id -nu)" "$(uname -n)")' },
      { label: "Capture a command's output", cmd: "result=$(command -v rg)" },
      {
        label: "List every user's crontab",
        cmd: "for user in $(cut -f1 -d: /etc/passwd); do crontab -u $user -l 2>/dev/null; done",
      },
      { label: "Fork bomb (do not run)", cmd: ":(){ :|:& };:" },
    ],
  },
  {
    id: "ubuntu",
    tab: "Ubuntu 24.04",
    glyph: "ubuntu",
    env: "ubuntu/24.04",
    desc: "The Debian package tools on Ubuntu",
    commands: [
      { label: "Install a package", cmd: "apt-get install -y nginx" },
      { label: "Search the package index", cmd: "apt-cache search nginx" },
      { label: "Show which version is available", cmd: "apt-cache policy nginx" },
    ],
  },
  {
    id: "el9",
    tab: "EL9",
    glyph: "rocky",
    env: "el9",
    desc: "The RHEL package tools on Rocky, Alma and RHEL",
    commands: [
      { label: "Install a package", cmd: "dnf install -y httpd" },
      { label: "List installed packages", cmd: "rpm -qa | sort" },
      { label: "Check for updates", cmd: "dnf check-update" },
    ],
  },
  {
    id: "alpine",
    tab: "Alpine 3.22",
    glyph: "alpine",
    env: "alpine/3.22",
    desc: "The apk tools on Alpine",
    commands: [
      { label: "Install a package", cmd: "apk --no-cache add curl" },
      { label: "Show a package's details", cmd: "apk info -a busybox" },
      { label: "Upgrade what is available", cmd: "apk upgrade --available" },
    ],
  },
];
