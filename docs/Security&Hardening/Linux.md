---
title: Linux Hardening
icon: simple/linux
---

### Physical Security

One of the security principles is Defence-in-Depth. Hence, we should always think in terms of layers of security. One of the first layers is physical security.

**Adding a GRUB password**

```bash
grub2-mkpasswd-pbkdf2
```

### Filesystem Partitioning and Encryption

LUKS is the standard for Linux hard disk encryption. By providing a standard on-disk-format, it does not only facilitate compatibility among distributions, but also provides secure management of multiple user passwords. 

[LUKS: Disk Encryption](https://guardianproject.info/archive/luks/)

###  Set up LUKS from the command line

* Installing

```bash
apt install cryptsetup
```

* Confirm the partition name using

```bash
lsblk
```

* Set up the partition for LUKS encryption

```bash
cryptsetup -y -v luksFormat /dev/sdb1
```

* Access the partition

```bash
cryptsetup luksOpen /dev/sdb1 EDCdrive
```

* Confirm mapping details: 

```bash
ls -l /dev/mapper/EDCdrive
```

```bash
cryptsetup -v status EDCdrive
```

* Overwrite existing data with zero

```bash
dd if=/dev/zero of=/dev/mapper/EDCdrive
```

* Format the partition

```bash
mkfs.ext4 /dev/mapper/EDCdrive -L "Strategos USB"
```

* Mount it and start using it like a usual partition

```bash
mount /dev/mapper/EDCdrive /media/secure-USB
```

* Check the LUKS setting

```bash
cryptsetup luksDump /dev/sdb1
```

E.G image
* Open/decrypt an image with cryptsetup.

```bash
sudo cryptsetup luksOpen /home/user/secretvault.img myvault
```

*  Create a directory to mount it to:

```bash
mkdir ~/myvault
```

* Mount the decrypted device

```bash
sudo mount /dev/mapper/myvault ~/myvault
```

### Firewall

in progress..


