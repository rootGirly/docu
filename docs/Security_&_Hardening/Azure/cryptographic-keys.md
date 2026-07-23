---
title: Cryptographic keys in Azure Key Vault
icon: lucide/folder-key
---

## Intro - Cryptographic keys in Azure Key Vault

A key unrotated for three years isn't just a policy violation, it's an exposure window.

### Key types and protection levels

* **RSA keys** are asymmetric keys used for: 
	* encryption, decryption, digital signatures, and key wrapping. 
	* Key Vault supports sizes of **2,048 bits**, **3,072 bits**, and **4,096 bits**. RSA-2048 is the minimum for production use; RSA-4096 is appropriate for long-term data protection or where extended assurance is required.

* **Elliptic curve (EC)** keys are asymmetric keys used for:

	* Digital signatures. 
	*  The supported curves are **P-256**, **P-384**, **P-521**, and **P-256K** (secp256k1). EC keys produce smaller key material at equivalent security strength compared to RSA, making them efficient for certificate operations and signing workloads.

* **Symmetric (octet)** keys are used for symmetric encryption. Software-protected octet keys support **128-bit, 192-bit, and 256-bit sizes**. Unlike RSA and EC keys, octet keys can't be HSM-backed in the Key Vault Premium service—they're supported as HSM keys only on Azure Key Vault Managed HSM.


### Bring Your Own Key (BYOK)

Some organizations operate under regulatory requirements that go beyond the default cloud key management model. They must demonstrate that key material was generated within a boundary they controlled, and that the cloud provider could never access the plaintext key. Bring Your Own Key (BYOK) addresses this requirement.

The transfer mechanism uses a **Key Exchange Key (KEK)**

### Configure key autorotation

Manual rotation relies on humans remembering to act. Autorotation removes that dependency. 

A **rotation policy** on a key specifies:

* **Rotation time**: how frequently Key Vault creates a new version. Set rotation time based on your compliance requirements and operational risk tolerance.
* **Expiry time:** the lifetime of each key version after which Key Vault marks it as expired. For fully automated rotation, expiry must also be set.
* **Notification time:** the number of days before expiry at which Key Vault publishes a near-expiry event to Azure Event Grid.

```JSON
{
  "lifetimeActions": [
    {
      "trigger": { "timeAfterCreate": "P18M" },
      "action": { "type": "Rotate" }
    },
    {
      "trigger": { "timeBeforeExpiry": "P30D" },
      "action": { "type": "Notify" }
    }
  ],
  "attributes": {
    "expiryTime": "P2Y"
  }
}
```

This policy rotates the key 18 months after creation and notifies 30 days before the two-year expiry date. The Azure CLI command to apply it:

``` bash
#Azure CLI

az keyvault key rotation-policy update \
 --vault-name <vault-name> \
 --name <key-name> \
 --value ./rotation-policy.json

```
![Microsoft Vault](https://learn.microsoft.com/en-gb/training/wwl-sci/manage-keys-secrets-key-vault/media/key-lifecycle-rotation-cycle.png)
>source learn.microsoft.com


### Key versioning and encrypted data

When a key rotates, Key Vault creates a new key version but retains all previous versions.

!!! warning ""

    Retaining previous versions is critical: data that was encrypted using the previous key version remains possible to decrypt because that version is still present in the vault.
    
!!! danger "Important"

    Key rotation generates a new key version with new key material. Both the old and new key versions must remain enabled until any dependent services updated their data encryption key (DEK) wrapping to use the new version. Disabling the old key version before DEK rewrapping is complete, breaks decryption for any data still wrapped under the old version.
    
### Key expiry and Event Grid notifications

Additionaly to **autorotation**, I can set `NotBefore` and `Expires` attributes on individual key versions to control their operational window. 

A key version with a future `NotBefore` date isn't usable until that date—useful for pregenerating a replacement key during a planned cutover. A key version with a past Expires date signals to consuming services that it should no longer be used for new operations.

## Manage secrets in Azure Key Vault

A credential without an expiry is a credential that can be used forever by anyone who obtains it.

### Distinguish secrets from keys and certificates

**A secret is any sensitive string value:**

* connection strings
* API keys
* passwords
* storage account keys
* tokens
* similar credentials


**Keys perform cryptographic operations** (signing, encrypting, wrapping). 

**Certificates assert identity through a Public Key Infrastructure (PKI)** chain. 


### Secret versioning and lifecycle attributes

Every time you update a secret value, Key Vault creates a new version of that secret. The old version is retained you can retrieve it, audit access to it, and disable it. This versioning behavior is central to safe secret lifecycle management.

**Two important attributes on any secret version:**

* **Enabled/Disabled**: A disabled secret version can't be retrieved. Disabling (rather than deleting) a version is the correct way to deprecate a credential while retaining the audit trail. If an incident investigation later requires knowing when a specific credential was active, the disabled version and its access log are still available.
* **Expires:** Set an expiry date on each secret version to establish a maximum credential lifetime. When a version expires, Key Vault still allows retrieval expiry is informational, not a hard enforcement block.


To set an expiry date on an existing secret version in the portal:

1. Open your Key Vault and select **Secrets** under **Objects**.
2. Select the secret you want to update.
3. Select the **Current Version ID**.
4. Set the **Expiration date** and select Save.

![Set an expiry date](https://learn.microsoft.com/en-gb/training/wwl-sci/manage-keys-secrets-key-vault/media/set-secret-expiration.png)


### Configure Key Vault references for applications

The most operationally elegant secret rotation pattern is one where the application never needs to be redeployed. **Key Vault references** in **Azure App Service** and A**zure Functions** makes seamless application key usage possible.

Instead of storing a connection string directly in an app setting, you store a reference:

``` bash
@Microsoft.KeyVault(SecretUri=https://<vault-name>.vault.azure.net/secrets/<secret-name>)
```

### single-credential rotation

The simplest rotation pattern for a secret is single-credential rotation: one secret, updated to a new value in a single atomic operation.

1. Generate a new credential (password, key, token).
2. Update the target system to accept the new credential.
3. Update the secret in Key Vault with the new value (creating a new version).
4. The application reads the new value at the next request.

The challenge with single-credential rotation is the brief transition window between steps 2 and 3 (or 3 and 4). If the application reads the old version before the new value is live in the target system, the authentication fails.

### Dual-Credential rotation

Dual-credential rotation eliminates the transition window by maintaining two valid credentials simultaneously in the target system. The pattern accommodates the full rotation cycle without a moment when both the application and the target system agree on a valid credential.

**Walkthrough**

* **Set up**: The database has two sign-in credentials - `db-user-a` and `db-user-b`. Both are valid. The vault's active secret contains the password for `db-user-a`. The application uses the secret (versionless URI) to authenticate.
* **Rotate credential B first**: Generate a new password for `db-user-b`. Update the database sign-in for `db-user-b` with the new password. The application is still using `db-user-a` - nothing disrupts it.
* **Store credential B as the new secret version**: Add the new `db-user-b` password to Key Vault as a new version of the secret. The versionless reference in the application now resolves to `db-user-b`.
* **Verify the application uses credential B**: Confirm the application is authenticating with `db-user-b`. You can validate this through query logs, connection tracing, or diagnostic logs.
* **Rotate credential A**: Now that the application runs on `db-user-b`, generate a new password for `db-user-a`. Update the database sign-in. The application isn't using `db-user-a`, so this change causes zero disruption.
* **Store credential A as the next secret version:** Add the new `db-user-a` password as the next version. The cycle is complete.

Credentials alternate on each rotation cycle. At no point, does a rotation event leave the application without a valid credential in the target system.



