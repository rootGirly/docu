---
title: Introduction to Privileged Identity Management (PIM)
icon: lucide/shield-check
---

# Introduction to Privileged Identity Management (PIM)

### Key Concepts:

* **Standing privilege:** is a privileged role assignment that's permanently active regardless of whether the role is being used. This is create by default when administrators receive role assignments directly.
* **Blast radius** is the scope of systems, data, and operations an attacker can reach when they exploit a compromised identity.
* **Control plane:** the management layer through which cloud resources are created, configured, and deleted. 
* **Eligible assignment:** you hold the entitlement to a role but don't hold the role itself until you explicitly request **an activation**.
* **Active assignment:** grants the role directly, making access immediate without any activation step
* **Role settings** are the per-role configuration in PIM that governs the conditions any eligible user must satisfy before PIM grants access to that role.
* **Break-glass account** (also known as an emergency access account) in Microsoft Entra ID is a dedicated, high-privilege account used exclusively to regain access to the tenant during critical failures, such as Conditional Access misconfigurations, widespread MFA outages, or identity provider failures


**Scope Global Administrator in Microsoft Entra ID:**

* Users accounts
* Group memberships 
* Application registrations
* Federated trust settings 
* Every Azure subscription linked to the directory

 
## Just-in-time (JIT) access as the response to standing privilege

**Just-in-time (JIT)** access provides elevated permissions that you don't hold persistently. You activate them for a specific task, and they expire after a defined period.

**Properties:**

- [x] You don't hold access by default
 	* no persistent credentials for an attacker to discover or steal between sessions 	
- [x] You activate access intentionally. 
 	* You must take a deliberate action to elevate your permissions
- [x] Access expires automatically
 	* Even if a session is compromised, the attacker's window closes when it ends 

 	
**The just-in-time (JIT)** model in practice: permissions exist as potential, not active reality, until you need them

| Item        | Eligible           | Active |
| ----------- | ------------------ | -------|
| Access state | Entitlement held; role isn't active | Role assigned; access is live immediately | 
| Activation required | Yes | No | 
| Expiration | Configurable; assignment expires, or session expires after the activation duration | Configurable; assignment expires at a set time | 
| When to use | Default JIT posture for most privileged roles | Scenarios requiring immediate, time-bounded access |

## Activation controls

These controls create a checkpoint between the entitlement and the live session ensuring that a stolen credential alone isn't enough to obtain elevated permissions.

* **Multifactor authentication (MFA) verification**: confirms your identity before elevation
* **Justification:**  you must supply before PIM grants the session, creating an auditable record of why access was requested.
* **Approval:** a delegated approver must confirm the request before PIM activates the role, adding a human checkpoint for sensitive assignments.
* **Activation duration:** the configured maximum time window, measured in hours (from 1 to 24 hours), after which PIM automatically removes the role, limiting the exposure window for any single session.

!!! note

    These controls are configurable per role—some roles require all four, while others require only MFA verification. Matching the controls to the sensitivity of each role is how you balance security friction with operational practicality.
    
![PIM activation lifecicle](https://learn.microsoft.com/en-us/training/wwl-sci/implement-configure-privileged-identity-management/media/activation-lifecycle.png) 
> source : microsoft.com


## Identify Microsoft Entra roles that should never be permanent

| Role        | Why it must be JIT | 
| ----------- | ------------------ |
| **Global Administrator** | Broadest blast radius in the tenant full control over all directory settings and services | 
| **Privileged Role Administrator** | Can modify any role assignment, including its own |
| **Security Administrator** | Controls security policy configuration across the tenant |
| **Exchange Administrator** | Has full access to email and calendar infrastructure |
| **Application Administrator** | Can register apps and modify application credentials |
| **Authentication Policy Administrator** | Controls authentication methods policy, tenant-wide multifactor authentication (MFA) settings, and password protection policy |


!!! warning

    Before you make Global Administrator eligible in PIM, verify that at least two emergency access (break-glass) accounts hold a permanent active assignment to the role. Store the break-glass credentials securely offline. Without this safeguard, a misconfiguration or an identity provider outage could lock every administrator out of the tenant with no recovery path.


# Assign eligible access to a Microsoft Entra role

1. Sign in to the [Microsoft Entra](https://entra.microsoft.com/)  admin center and open **ID Governance > Privileged Identity Management**.
2. Under **Manage**, select **Microsoft Entra roles**.
3. Under **Manage**, select **roles** example, **Global Administrator**.
4. Select **Assignments > Add assignments**.
5. Set Assignment **type** to **Eligible**.
6. Select the member and set the assignment duration (permanent or time-bound).
7. Select **Assign** to complete the assignment.

!!! tip

    This change converts standing access to a JIT entitlement—the role now appears in the user's eligible assignments but grants no active privileges until they complete an activation.

## Configure role settings for activation

The following table shows recommended activation controls organized by privilege tier.

| **Privilege tier**        | **Example roles** |  **MFA**       | **Justification** | **Approval** | **Max duration** |
| ----- | -------- | -------  | ------ | ---- | ---|
| Critical | Global Admin, Privileged Role Admin | Required  | Required | Required | 1–2 hours |
| High | Security Admin, Privileged Authentication Admin | Required  | Required | Recommended | 4–8 hours|
| Moderate | Exchange Admin, App Admin | Required  | Required | Optional | 8 hours |

## Activate an eligible Microsoft Entra role

Activation is the step that converts an eligible assignment into a live, time-limited session.

1. In PIM, select **My roles** > **Eligible assignments**.
2. Find the role and select Activate.
3. Set the activation duration (within the maximum configured in role settings).
4. Enter a justification describing the task requiring elevated access.
5. If approval is required, submit the request and wait for approver action.
6. Confirm the role appears under Active assignments with a duration countdown.


# Implement just-in-time access for Azure roles and resources

Navigate to **ID Governance** > **Privileged Identity Management** > **Azure resources**. Here, you're managing RBAC assignments.

| | **Microsoft Entra roles** | **Azure resource roles** |
|------ | ----- | ----- |
| **PIM navigation** | ID Governance → PIM → Microsoft Entra roles 	 | ID Governance → PIM → Azure resources |
| **Scope** | Tenant (directory-wide) | Subscription / resource group / resource |
| **Discovery required** | No | No—PIM manages Azure resources automatically |
| **Example roles** | Global Administrator, Security Administrator | Owner, Contributor, Key Vault Administrator |


### Identify which resources need the tightest access controls

The right activation controls depend on four factors:

* Data sensitivity
* Blast radius
* Regulatory exposure
* Reversibility of any damage



| **Risk tier** | **Resource examples** | **Risk reason** | **Recommended activation controls** |
|------ | ----- | ----- | ---- |
| **Critical** | Production subscription, Key Vault, Azure AI services	 | Compromise grants broad lateral movement; Key Vault secrets unlock downstream systems; AI model weights and training data represent exfiltratable IP | multifactor authentication (MFA) required, justification required, approval required, 1–2 hour max |
| **High** | Production resource group, Azure SQL, Azure Kubernetes Service	 | Narrower scope but high data sensitivity or service continuity risk | MFA required, justification required, approval optional, 4–8 hour max |
| **Standard** | Dev/test resource groups, sandbox subscriptions	 | Low data sensitivity; mistakes are reversible | MFA required, justification required, no approval, up to 8 hours |


## Assign eligible access to an Azure resource role

!!! note ""

    If you navigate to Azure resources and your subscriptions or resource groups don't appear, select Discover resources before troubleshooting permissions or other issues. Some tenants or older PIM configurations can require this one-time step to surface resources in the list.
    
1. In PIM, select **Azure resources**.
2. Navigate to the target resource—for example, a Key Vault—using the Subscriptions or Resource groups dropdown, and under **Manage**, select **Roles**, then select **Add assignments**.
3. Select the Azure resource role—for example, **Key Vault Administrator**.
4. Set **Assignment type** to **Eligible**.
5. Select the member and configure the assignment duration.
6. Select **Assign** to complete the assignment.


## Why group-based JIT enforces policy more consistently

![Direct Eligible assignments](https://learn.microsoft.com/en-us/training/wwl-sci/implement-configure-privileged-identity-management/media/privileged-groups-scale-comparison.png)
> source: microsoft.com

### When to choose group-based JIT

just-in-time access (JIT) is the right model when two or more of these conditions are true: 

* Your team has more than a few users who need the same access pattern, that access recurs regularly.
* The required permissions span multiple roles or resources that logically belong together.


# Applying JIT access to AI workloads, agents, and applications


### The AI control plane as a privileged attack surface

Azure OpenAI and Azure Machine Learning control planes carry Critical-tier risk. A compromised Cognitive Services OpenAI Contributor can:

* Enumerate deployed models
* Redirect endpoint configurations 
* Exfiltrate model weights from connected storage  
* Inspect fine-tuning datasets


### The principal boundary, humans versus workload identities.

* **An eligible role works** through an interactive session — MFA, justification, and approval if policy requires it.
* **A managed identity:** assigned directly to Azure resources such as container apps, virtual machines, and functions—authenticates non-interactively.

![Microsoft Workload identities](https://learn.microsoft.com/en-us/training/wwl-sci/implement-configure-privileged-identity-management/media/privileged-human-vs-workload-access.png)


**The clean two-track rule**: PIM governs the humans who configure, deploy, and manage AI services. RBAC governs the workload identities that run them.


## Patterns for JIT access design

| **Patterns** | **When to apply** | **What it prevents** | **Key trade-off** |
| ---- | --- | ---- | --- |
| Eligible by default, activate when needed | All roles except break-glass and workload identities | Standing privilege, unlimited exploitation window | Activation friction for routine tasks |
| Short activation windows for production | Critical and High-tier resources (production subscriptions, Key Vault, AI control planes) | Prolonged access after task completes | Requires reactivation for extended work |
| Approval for high-privileged roles | Critical-tier roles where a single activation could cause irreversible damage | Unilateral privilege escalation | Approval latency; requires designated approvers |
| Regular access reviews | All eligible assignments, quarterly minimum | Privilege accumulation; stale assignments | Operational overhead for reviewers |
| Emergency access excluded from JIT | Break-glass accounts only | JIT dependency failure during an outage | Must compensate with maximum monitoring and documented procedure |

### The break-glass exception

Break-glass accounts are excluded from JIT not because they're exempt from governance, but because PIM's activation path—which depends on multifactor authentication (MFA), approver availability, and service health—can itself fail during the outage conditions that require emergency access.

!!! failure ""

    Break-glass accounts must never be used for routine tasks. Any activation should trigger an immediate investigation to determine whether the use was authorized and whether underlying access gaps need to be addressed.
    
    
>A privileged access strategy holds together not because every control is configured, but because the decisions behind those controls can be explained and defended