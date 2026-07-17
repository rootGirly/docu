---
title: Active Directory Hardening
icon : lucide/folder-cog
---
# General Concepts


### Domain

It stores all the critical information about the objects that belong to the domain only. Is the logical structure of the Active Directory.

### Domain Controller

Is an Active Directory server that acts as the brain for a Windows server domain.

``` mermaid
graph LR
  A[Users tries to access the domain] --> B[The request is first send to the DC] --> C[DC validates the request] --> D[Grant/Deny Access]
```

### Trees and Forests

**Trees:** A set of Domains, are responsible for sharing resources between the domains.
**Forest:** A set of trees

### Trust in Active Directory
 
Is the established communication bridge between the domains in Active Directory.

AD trusts categorised based on characteristics are known as Transitive and non-Transitive trusts. Transitive trust reflects a two-way relationship between domains. If there are three domains, domain A trusts domain B and domain B has a transitive trust with domain C. Consequently, domain A will automatically trust domain C for sharing resources.

I can access the AD trust through the following:
Server Manager > Tools > Active Directory Domains and Trust`



