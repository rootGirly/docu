---
title: Linux System Hardening
description: A Defense-in-Depth Architecture
author: bytegirl
icon: simple/linux
---


# Linux System Hardening: A Defense-in-Depth Architecture

## Intro
This document outlines a security engineering framework for hardening Linux infrastructure. Rather than a simple checklist of commands, this guide maps specific technical controls to **threat vectors**, defines **implementation** for reproducibility, and establishes **validation** to ensure control effectiveness.

The approach follows the **Defense-in-Depth (DiD)** principle, layering physical, cryptographic, network, and identity controls to minimize the attack surface against determined adversaries.

---

## Physical Security & Boot Integrity
### Threat Model
- **Physical Access Attacks**: Adversaries with physical access can bypass OS-level security via bootable media or direct memory access.
- **Bootloader Manipulation**: Unauthorized modification of kernel parameters or loading unsigned kernels.

### Control Strategy
Enforce hardware-level trust by securing the GRUB bootloader. This prevents unauthorized users from modifying kernel boot parameters or accessing recovery modes.

### Implementation Pattern
**Objective:** Set a unique, PBKDF2-hashed password for the GRUB2 bootloader to prevent unauthorized boot modifications.

1. Generate the hashed password:

```bash
   grub2-mkpasswd-pbkdf2
   # Output format: grub.pbkdf2.sha512.10000.<SALT>.<HASH>
```   
   
2. Append the hash to /etc/grub.d/40_custom and update configuration.

**Validation**: Reboot the system. Attempt to edit boot parameters without the password; the system must deny access.


## Data at Rest: LUKS Encryption Architecture

### Threat Model

- **Device Theft/Loss:** Hard drives removed and mounted on another system to exfiltrate data.
- **Cold Boot Attacks**: Extraction of encryption keys from RAM (mitigated by full disk encryption + secure shutdown).

### Control Strategy

Use [LUKS (Linux Unified Key Setup)](https://github.com/guardianproject/luks/wiki) to provide standardized, interoperable disk encryption. LUKS supports multiple user passwords and secure header management.

### Implementation Pattern

**Scenario:** Encrypting a secondary partition (/dev/sdb1) for sensitive field data.


Phase A: Preparation & Verification

```bash
# Verify device identity to prevent accidental overwrites
lsblk
# Install encryption tooling
apt install cryptsetup
```

Phase B: Volume Initialization

Note: This operation destroys existing data.

```bash
# Format with LUKS headers
cryptsetup -y -v luksFormat /dev/sdb1

# Open the encrypted volume
cryptsetup luksOpen /dev/sdb1 EDCdrive
```

Phase C: Secure Erasure (Optional but Recommended)

To prevent forensic recovery of old data prior to encryption:

```bash
dd if=/dev/zero of=/dev/mapper/EDCdrive bs=1M status=progress
```

Phase D: Filesystem & Mounting

```bash
# Create ext4 filesystem with label
mkfs.ext4 /dev/mapper/EDCdrive -L "StrategosUSB"

# Persist mount point (requires /etc/fstab configuration in production)
mkdir -p /media/secure-USB
mount /dev/mapper/EDCdrive /media/secure-USB
```

Phase E: Validation

Verify the LUKS header and mapping state:

```bash
cryptsetup luksDump /dev/sdb1
cryptsetup -v status EDCdrive
ls -l /dev/mapper/EDCdrive
```

## Network Perimeter: Packet Filtering Architecture

### Threat Model

- **Unauthorized Inbound Connections**: Scanning and exploitation attempts.
- **Data Exfiltration**: Malware establishing outbound C2 channels.
- **Lateral Movement**: Unauthorized traffic between network segments.


### Control Strategy

Deploy a **Default Deny** policy using Netfilter (via iptables or nftables). The architecture separates traffic into INPUT, OUTPUT, and FORWARD chains.

### Implementation 

**Infrastructure State (Netfilter)**
Netfilter handles packet inspection; iptables provides the user-space interface.

**SSH Access Policy (Allowlisting)**
Strategy: Allow SSH (Port 22) only, then drop everything else.

```bash
# Flush existing rules to ensure clean state
iptables -F

# Allow established connections (stateful inspection)
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow inbound SSH
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow outbound responses
iptables -A OUTPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT

# Default Deny Policies
iptables -A INPUT -j DROP
iptables -A OUTPUT -j DROP
```


###  UFW

For operational simplicity in non-critical environments, use Uncomplicated Firewall (UFW):

```bash
sudo ufw allow 22/tcp
sudo ufw enable
sudo ufw status verbose
```

```markdown
Validation:

Attempt to connect to port 22 from an authorized IP (Success).
Attempt to connect to port 80 or 443 (Failure/Timeout).
Check logs: iptables -L -v -n to verify hit counts on DROP rules.
```

## Remote Access Hardening

### Threat Model
- **Brute Force Attacks:** Automated credential stuffing.
- **Credential Theft:** Phished passwords or keyloggers.
- **Root Compromise:** Privilege escalation to full system control.

### Control Strategy
Shift from password-based authentication to Public Key Infrastructure (PKI) and enforce strict privilege separation.

### Implementation

**Key Generation (Ed25519)**

Ed25519 offers superior security and performance compared to RSA.

```bash
ssh-keygen -t ed25519 -C "byteSSH@server"
```

**Deployment**

```bash
ssh-copy-id -i ~/.ssh/byteSSH.pub byteName@byteServer
```
**Server Configuration** `(/etc/ssh/sshd_config)`

Apply the following hardened settings:

* PubkeyAuthentication yes : Enables PKI auth
* PasswordAuthentication no : Eliminates brute-force vector
* PermitRootLogin no: Prevents direct root compromise.
* MaxAuthTries 5: Limits automated guessing

```bash
# Apply changes
sudo systemctl restart sshd
```

> **Critical Pre-check:** Always verify console access before disabling password auth to prevent lockout during remote deployment.

## Identity & Access Management (IAM)

### Threat Model

- **Privilege Escalation:** Accidental or malicious system modification by standard users.
- **Account Compromise:** Stale accounts used as backdoors.

### Control Strategy

Implement Least Privilege via sudo delegation and rigorous account lifecycle management.

### Sudoers Group Management

Avoid direct root login. Grant administrative capabilities via the sudo group.

```bash
usermod -aG sudo username
```

* -aG: Appends to group (preserves existing groups).
* sudo: The privileged group on Debian/Ubuntu.


### Password Complexity Enforcement
Leverage libpwquality to enforce entropy requirements.

**Install:** `apt-get install libpam-pwquality`

Configuration `(/etc/security/pwquality.conf)`:

```vim
difok=5          # Min chars different from old password
minlen=10        # Minimum length
minclass=3       # Must include upper, lower, digit, or special
retry=2          # Lockout after failed attempts
badwords=dns,net # Block domain-specific weak words
```


### Account Lifecycle

Disable unused accounts by changing their shell to /sbin/nologin:

```bash
# Before
byteShell:x:1000:1000:byteShell:/home/byteShell:/usr/bin/fish
# After (Disabled)
byteShell:x:1000:1000:byteShell:/home/byteShell:/sbin/nologin
```

## Observability & Audit Configuration

### Threat Model

- **Post-Incident Blindness**: Inability to reconstruct attacker activity.
- **Compliance Failure**: Lack of audit trails for regulatory requirements.


### Control Strategy

Centralize logging of authentication, kernel events, and system state changes.


**Log Inventory:**

* `/var/log/auth.log`: Authentication events (Debian)
* `/var/log/secure`: Auth events (RHEL/Fedora)
* `/var/log/kern.log`: Kernel messages (Driver failures)
* `/var/log/wtmp`: Login history (All sessions)
* `/var/log/utmp`: Current logged-in users


## Maintenance & Patch Management

### Threat Model

- **Zero-Day Exploitation**: Unpatched vulnerabilities.
- **Legacy Protocol Abuse**: Use of deprecated, insecure services.

### Control Strategy

Automated patching and service reduction.

```bash
# Update package lists and upgrade installed packages
apt update && apt upgrade -y

# Disable unnecessary services
systemctl disable <service_name>
systemctl mask <service_name>
```

### References & Standards

* NIST SP 800-123: [Guide to General Server Security](https://www.nist.gov/publications/guide-general-server-security)
* [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks): Linux Hardening Guidelines
* LUKS Spec: https://guardianproject.info/archive/luks/








