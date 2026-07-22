---
title: Introduction to Azure Key Vault
icon : material/key
---

## Overview

**Azure Key Vault** is a cloud service for securely storing and managing secrets: things like API keys, passwords, certificates, and encryption keys so they're not hardcoded in the app's code or config files. Apps retrieve them at runtime with proper access controls (via **Entra ID**) instead of storing them in plain text.

# Understanding the Key Vault access model


Azure Key Vault separates access into two distinct planes: **the control plane** and **the data plane**.

**The control plane** governs the vault itself and uses Azure Resource Manager (**ARM**).

**The data plane** governs items stored inside the vault-keys, secrets, and certificates. 

![Microsoft security vault](https://learn.microsoft.com/en-gb/training/wwl-sci/configure-secure-key-vault/media/key-vault-access-planes.png)

## Azure RBAC instead of legacy access policies

Key Vault supports two authorization models for the data plane: 

* Azure role-based access control (RBAC)
* Legacy vault access policies. (Not recommended for new workloads)

A functional limitation to **access policies**: they don't support Privileged Identity Management. If you want to apply just-in-time elevation for Key Vault operations—which you do—access policies can't participate in that model.

!!! tip ""

    If you operate existing vaults still using access policies, migrating to RBAC is a security hardening action, not just a modernization preference. Legacy access policies expose your data plane to anyone with Contributor on the vault.
    
### Assign the right data plane role for each workload

| **Role** | **Plane** | **What it governs** |
| ---- | ---- | ---- |
| Owner, Contributor | Control plane | The vault resource itself—create, configure, and delete via ARM template |
| Key Vault Administrator, Secrets User, Certificates Officer, Purge Operator | Data plane | The vault content—keys, secrets, certificates |

**Note**: The goal is to assign the most restrictive role that satisfies the workload's requirements—not the most convenient one.


**Key Vault Administrator:** grants full data-plane access to all keys, secrets, and certificates in the vault. Key Vault Administrator is the most powerful role in Key Vault and should never be a permanent assignment for humans. Reserve it for break-glass scenarios activated through a privileged access process, and for automation that genuinely requires cross-object access.

**Key Vault Secrets** User grants read-only access to secret values. Secrets user is the correct role for application service principals and managed identities that retrieve database connection strings, API keys, or other runtime secrets.

**Key Vault Certificates Officer** allows full lifecycle management of certificates—creating, importing, updating, and deleting—without touching secrets or keys. 

**Key Vault Purge Operator** allows permanent deletion of soft-deleted vault objects.

### Eliminate persistent elevated access with Privileged Identity Management

Standing access with no expiration means the only event that removes it's a deliberate deprovisioning action, which can never happen. In that window, any account compromise becomes a full Key Vault compromise.

Microsoft Entra Privileged Identity Management (PIM) replaces permanent role assignments with eligible assignments. An eligible user doesn't hold the role. When they need elevated Key Vault access, they request activation through PIM, which enforces the controls you configure: justification, approval from a designated approver, MFA reverification, and a maximum activation duration. After the window closes, the role is automatically removed and the next request starts the same process. Every activation produces a timestamped audit entry—who requested it, who approved it, when it was active, and when it expired.


## Restricting access with firewall rules and IP allow lists.

When you create a new Key Vault, the firewall is disabled and public network access is enabled. Any internet IP address can resolve your vault's public DNS name and send authentication requests to it.

The first level of network hardening is enabling the Key Vault firewall and adding explicit allow rules. When the firewall is enabled without any configured rules, all traffic is blocked by default. You then add the specific IPv4 addresses or Classless Inter-Domain Routing (CIDR) ranges that should have access.


### Route virtual network traffic over the Azure backbone using service endpoints


When you enable the `Microsoft.KeyVault` service endpoint on a virtual network subnet and add that subnet to your Key Vault network rules, traffic from that subnet travels over the Azure backbone network rather than the public internet.

### Fully isolate Key Vault with private endpoints

Azure Private Link eliminates the residual public exposure of service endpoints by assigning Key Vault a private IP address inside your virtual network. The vault is no longer reachable from the internet once you combine a private endpoint with disabling public network access. The only way to reach the vault is through your virtual network, or through connected networks—an on-premises environment connected via Azure ExpressRoute or a site-to-site VPN, for example.

**Two components are required for private endpoint connectivity to work correctly:.**

The **private endpoint resource:** a network interface in your virtual network subnet, bound to Key Vault via Azure Private Link, that receives a private IP address.

A **private DNS zone:** Without DNS integration, clients resolve your vault's public IP regardless of the private endpoint. Configure the `privatelink.vaultcore.azure.net` zone and link it to the virtual network so that `<vault-name>.vault.azure.net` resolves to the private IP. The Azure portal offers automatic DNS integration during private endpoint creation.

!!! note ""

    Disabling public network access affects some Microsoft-managed services that need to reach Key Vault—including Azure Monitor and Azure Backup. Use the Allow trusted Microsoft services to bypass this firewall exception for services in this category, or ensure those services connect through a path in your private network. Review the trusted services list before enabling this bypass, as it covers only services that Microsoft fully controls.

### Choose the right isolation model for your workload


Not every vault requires the same level of network isolation. Matching the model to the workload keeps the configuration maintainable and appropriate for the risk.

![Microsoft Key Vault Model](https://learn.microsoft.com/en-gb/training/wwl-sci/configure-secure-key-vault/media/key-vault-isolation-model.png)

* **Private endpoint with public access disabled**  the recommended architecture for production workloads storing sensitive data. 
* **VNet service endpoints** appropriate when private endpoints aren't feasible due to virtual network architecture constraints. Eliminates internet routing for controlled workloads, but the public endpoint persists.
* **IP-based firewall rules** a valid transitional state for tightly bounded use cases such as CI/CD pipelines from build agents with static IPs. Not a long-term production architecture.
* **Network Security Perimeter (NSP):** a GA option for organizations that need to define a logical isolation boundary across multiple PaaS resources (Key Vault, Storage, SQL Database) outside your virtual network perimeter. NSP uses `publicNetworkAccess: SecuredByPerimeter` and supports inbound/outbound access rules. Note the setting overrides the trusted Microsoft services bypass-services relying on that bypass, such as Azure Monitor and Azure Backup, are blocked if NSP is active.
* **Trusted services bypass:** needed when Microsoft-managed services like Azure Monitor, Azure Backup, or Azure Site Recovery require Key Vault access that can't be routed through your private network. Not applicable when NSP is in use.




