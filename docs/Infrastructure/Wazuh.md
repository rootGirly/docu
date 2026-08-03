---
title: Wazuh
icon: simple/opensearch
---

# Home SOC Lab: Wazuh + Proxmox + Tailscale

Reference build doc. Wazuh manager on bare-metal Proxmox at home, agents on 2 VPS + 1 laptop, connectivity via Tailscale. No public exposure.

---

## Stack

| Component | Role |
|---|---|
| Proxmox (bare metal) | Hypervisor, home |
| Wazuh manager VM | Manager + indexer (OpenSearch) + dashboard |
| Tailscale | Private mesh network, replaces port-forwarded WireGuard |
| Wazuh agents | 2x VPS, 1x macOS laptop |

**Why Tailscale over raw WireGuard:** no router admin access at home → can't port-forward. Tailscale handles NAT traversal itself, every device dials out, no public rendezvous point needed. Manager stays off the public internet entirely only reachable via its 100.x.x.x tailnet IP.

---

## Hardware / sizing

**Wazuh VM:**
- 3 vCPU, type `host` (not `kvm64` : passes through real CPU features)
- 6144MB RAM
- 80GB disk on `local-lvm` (not `local` - `local` is filesystem-backed, `local-lvm` is LVM block storage, needed for indexer I/O)
- VirtIO SCSI controller, VirtIO network adapter

**OpenSearch JVM heap:** capped at 2GB explicitly. Default auto-sizing can claim 50%+ of VM RAM, starving the manager/dashboard or getting OOM-killed under load which silently stops ingestion.

**Retention:** 90 days, revisit at scale.

---

## 1. Proxmox VM

Ubuntu Server 24.04. Full-disk partitioning during install, don't accept default undersized partitions.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl qemu-guest-agent
```

`qemu-guest-agent` is required for Proxmox to report the VM's real IP/stats.

---

## 2. Tailscale on all 4 devices

Manager, both VPS, laptop.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --hostname=wazuh-manager --ssh
```

Prints a login URL. On headless machines, this must be opened and authorized in a browser on another device the auth doesn't complete on its own. Devices show gray/offline in the admin console (`login.tailscale.com/admin/machines`) until authorized.

Verify:
```bash
tailscale ping wazuh-manager
```

---

## 3. Tailscale ACLs

Default tailnet behavior: every device reaches every device, all ports. Not acceptable for a SIEM control plane. Tag devices and apply an explicit-allow / implicit-deny policy.

**Tags:**
- `tag:soc-manager` → Wazuh manager VM only
- `tag:soc-agent` → VPS only, **not** personal admin devices (see gotcha below)

**Policy:**

```json
{
  "tagOwners": {
    "tag:soc-manager": ["autogroup:admin"],
    "tag:soc-agent":   ["autogroup:admin"]
  },
  "acls": [
    {
      "action": "accept",
      "src":    ["tag:soc-agent"],
      "dst":    ["tag:soc-manager:1514", "tag:soc-manager:1515"]
    },
    {
      "action": "accept",
      "src":    ["autogroup:admin"],
      "dst":    ["tag:soc-manager:443", "tag:soc-manager:55000", "tag:soc-manager:22", "tag:soc-manager:1514", "tag:soc-manager:1515"]
    },
    {
      "action": "accept",
      "src":    ["autogroup:admin"],
      "dst":    ["tag:soc-agent:22"]
    }
  ],
  "ssh": [
    {
      "action": "accept",
      "src":    ["autogroup:admin"],
      "dst":    ["tag:soc-manager", "tag:soc-agent"],
      "users":  ["autogroup:nonroot"]
    }
  ]
}
```

**Port rationale:**
- `1514` — agent → manager telemetry (TCP/UDP). Core data pipe.
- `1515` — agent enrollment/registration only. Not needed after initial enrollment; scope to admin-only once agents are onboarded.
- `443` — dashboard (HTTPS). Admin only.
- `55000` — Wazuh REST API. Admin only.
- `22` — SSH, gated separately by the `ssh` block below.

**Note on `ssh` block:** Tailscale SSH is a separate policy surface from network-layer `acls`. A `dst: [...22]` rule in `acls` does not grant Tailscale SSH access — without an explicit `ssh` block, it defaults to deny. `autogroup:nonroot` only, matching `PermitRootLogin no` hardening on the VPS via regular SSH — don't add `"root"` here, it reopens what that hardening closed.

### Gotcha: tagging a personal admin device breaks its own admin access

Tagging changes device *identity* for ACL matching. A device tagged `soc-agent` stops being seen as `autogroup:admin`, regardless of which account is logged in. Symptom: `tailscale ping` to the manager works (ICMP untouched by port rules), but `curl https://<manager-ip>:443` times out (port rule scoped to `autogroup:admin`, tagged device no longer matches).

Fix: keep personal devices (laptop) untagged, rely on `autogroup:admin`. Reserve tags for infrastructure with no single human owner (VPS). Removing an existing tag requires `tailscale logout` + re-auth — can't be stripped from the admin console alone once baked into a session.

---

## 4. Install Wazuh (manager VM)

```bash
curl -sO https://packages.wazuh.com/4.14/wazuh-install.sh
chmod 744 wazuh-install.sh
sudo bash wazuh-install.sh -a
```

All-in-one: manager + indexer + dashboard. ~15–25 min on N5105-class hardware. Long idle-looking stretches are normal.

Final output includes generated dashboard credentials — shown once, save immediately.

**Cap the indexer heap:**
```bash
sudo nano /etc/wazuh-indexer/jvm.options
```
```
-Xms2g
-Xmx2g
```
```bash
sudo systemctl restart wazuh-indexer
```

Verify it applied (don't trust the config file alone):
```bash
ps aux | grep opensearch
```

Confirm stack health:
```bash
sudo systemctl status wazuh-manager
sudo systemctl status wazuh-indexer
sudo systemctl status wazuh-dashboard
```

Access: `https://<manager-tailnet-ip>` — self-signed cert warning expected, acceptable since only reachable over an already-encrypted tailnet.

---

## 5. Enroll agents

### macOS
```bash
curl -O https://packages.wazuh.com/4.x/macos/wazuh-agent-4.14.7-1.arm64.pkg
sudo installer -pkg wazuh-agent-4.14.7-1.arm64.pkg -target /
sudo launchctl bootstrap system /Library/LaunchDaemons/com.wazuh.agent.plist
```

Config: `/Library/Ossec/etc/ossec.conf`

### Debian/Ubuntu VPS
```bash
curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | sudo gpg --no-default-keyring --keyring gnupg-ring:/usr/share/keyrings/wazuh.gpg --import
sudo chmod 644 /usr/share/keyrings/wazuh.gpg
echo "deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main" | sudo tee /etc/apt/sources.list.d/wazuh.list
sudo apt update
sudo WAZUH_MANAGER='<manager-tailnet-ip>' apt install wazuh-agent
sudo systemctl daemon-reload
sudo systemctl enable wazuh-agent
sudo systemctl start wazuh-agent
```

### Verify enrollment

Config points at manager:
```bash
sudo grep -A2 "<server>" /var/ossec/etc/ossec.conf   # or /Library/Ossec/... on macOS
```

Enrollment actually completed (registration handshake against 1515, separate from just installing):
```bash
sudo cat /var/ossec/etc/client.keys
```
Empty = never enrolled. Manual enrollment:
```bash
sudo /var/ossec/bin/agent-auth -m <manager-tailnet-ip>
```
Restart the agent after.

Confirm on manager:
```bash
sudo /var/ossec/bin/agent_control -l
```

---

## 6. Hardening after the pipeline is live

**Close 1515 to agents.** Once all agents enrolled, drop `1515` from the agent-facing ACL rule, keep it only in the admin rule — prevents a compromised agent from attempting re-enrollment/spoofing:
```json
{
  "action": "accept",
  "src":    ["tag:soc-agent"],
  "dst":    ["tag:soc-manager:1514"]
}
```

**Pre-shared enrollment secret** — second layer beyond network ACL:
```bash
sudo nano /var/ossec/etc/authd.pass
```
Future enrollments require `agent-auth -P '<secret>'`.

**MFA reality check.** Dashboard is tailnet-only → the actual MFA boundary is the Tailscale account login itself, not a separate Wazuh login. Confirm 2FA is enabled on the identity provider backing the Tailscale account.

TLS/cert setup (Tailscale-issued Let's Encrypt cert via `tailscale cert`) — not covered here, deferred.

---

## Next

- File Integrity Monitoring on VPS (`/etc`, `/usr/bin`, `/usr/sbin`, web app dirs)
- SSH brute-force active response — rule `5720` + `firewall-drop` script, auto-block after threshold
- Vulnerability detection module against installed packages
- Network IDS (Suricata/Zeek) feeding into the same manager
