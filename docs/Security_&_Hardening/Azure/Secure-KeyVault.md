---
title: Deploy and Secure Azure Key Vault
icon: lucide/user-key
---

## Overview

[Azure AI Foundry](https://ai.azure.com/home) is Microsoft's unified platform for building, testing, and deploying AI applications. it brings together model catalog access (OpenAI, Meta, and other models), fine-tuning, prompt orchestration, and agent-building tools in one workspace. It's essentially the successor/rebrand of what used to be Azure AI Studio.

# Deploy and Secure Azure Key Vault

Azure Key Vault supports two permission models: 

* **Vault access policies (the legacy model)**  
* **Azure role-based access control (the recommended model)**. The RBAC model integrates Key Vault access governance into the same role assignment system used across all Azure resources, making it easier to audit permissions and apply the principle of least privilege consistently. 

1. Sign in to the Azure portal using `https://portal.azure.com` using your Global Administrator credentials.
2. In the search bar, search for and select **Key vaults**.
3. Select + Create.
4. On the Basics tab, configure the following:

	| Setting | Value |
    |---------|-------|
    | **Subscription** | Your lab subscription |
    | **Resource group** | LAB-Key-Vault |
    | **Key vault name** | sc500KV |
    | **Region** | Europe Central |
    | **Pricing tier** | Standard | 
    
5. Select the **Access configuration** tab.
6. Under Permission model, select **Azure role-based access control (RBAC)**.

	> Note: The RBAC authorization model is selected at vault creation and cannot be changed without deleting and recreating the vault. If the vault is created with the legacy access policies model, the role assignment steps in this lab will not apply.

7. Select **Review + create**, then select **Create**.

	>Wait for the deployment to complete. This typically takes less than one minute.
	
8. Select **Go to resource** to open the vault.
9. On the Key Vault Overview page, locate the Vault URI field. Copy this value and save it — it follows the format `https://sc500KV.vault.azure.net/`. You will use it in a later section.
10. In the left menu, under **Settings**, select **Properties**.
11. Locate `Soft-delete` and confirm it shows Soft delete is enabled for this vault.

	> Note: Soft delete is enabled by default on all new Key Vault instances and cannot be disabled once set. It retains deleted secrets, keys, and certificates in a recoverable state for a configurable retention period (default: 90 days), protecting against accidental or malicious deletion.
	
12. Locate **Purge protection** and confirm it shows **Disabled**.
13. Select **Enable purge protection**, then select Save.

	> Note: Purge protection prevents permanent deletion of the vault or its objects during the soft-delete retention period, even by users with the Key Vault Contributor role. This is a one-way operation and cannot be reversed after it is enabled. In production environments, purge protection is recommended for any vault storing critical secrets or keys.
	
	
## Configuring access using Azure RBAC

With the vault created, I will assign four **RBAC roles** following the principle of least privilege. Rather than granting a broad administrator role to my **User-1 Administrator account**, I will assign two targeted roles: 

* **Key Vault Secrets Officer** (to create and manage secrets)
* **Key Vault Crypto Officer** (to create and manage keys). 

I will then grant the Key Vault Secrets User role to the App Service managed identity (which will retrieve secrets at runtime), and the Key Vault Reader role to User-2 (which I will use to verify that management-plane access does not grant data-plane access to secret values).

1. In the left menu of the Key Vault, select **Access control (IAM)**.

1. Select **+ Add**, then select **Add role assignment**.

1. On the **Role** tab, search for and select **Key Vault Secrets Officer**, then select **Next**.

    > **Note**: The **Key Vault Secrets Officer** role grants create, read, update, delete, and purge permissions for secrets only — it does not include access to keys or certificates. Assigning it separately from **Key Vault Crypto Officer** enforces separation: an account with only Secrets Officer cannot manage keys, and vice versa.

1. On the **Members** tab, confirm **Assign access to** is set to **User, group, or service principal**.

1. Select **+ Select members**, search for and select your **User-1** account (the account I am currently signed in with), then select **Select**.

1. Select **Review + assign**, then select **Review + assign** again to save.

1. Select **+ Add**, then select **Add role assignment** to begin a second assignment.

1. On the **Role** tab, search for and select **Key Vault Crypto Officer**, then select **Next**.

    > **Note**: The **Key Vault Crypto Officer** role grants create, read, update, delete, and purge permissions for keys only. Separating key management from secrets management is a Zero Trust design principle — the person or process that manages encryption keys is not automatically the same one that can read application secrets.

1. On the **Members** tab, confirm **Assign access to** is set to **User, group, or service principal**.

1. Select **+ Select members**, search for and select your **User-1** account (the account you are currently signed in with), then select **Select**.

1. Select **Review + assign**, then select **Review + assign** again to save.

1. Select **+ Add**, then select **Add role assignment** to begin a third assignment.

1. On the **Role** tab, search for and select **Key Vault Secrets User**, then select **Next**.

    > **Note**: The **Key Vault Secrets User** role grants read access to secret contents only — just enough for an application to retrieve a secret value at runtime. It does not allow creating, updating, listing, or deleting secrets. This is the minimum permission required for an application's managed identity to read a secret.

1. On the **Members** tab, set **Assign access to** to **Managed identity**.

1. Select **+ Select members**.

1. On the **Select managed identities** pane, set **Managed identity** to **App Service**, then select **my-own-app** from the list.

1. Select **Select**, then select **Review + assign**, then select **Review + assign** again to save.

1. Select **+ Add**, then select **Add role assignment** to begin a fourth assignment.

1. On the **Role** tab, search for and select **Key Vault Reader**, then select **Next**.

    > **Note**: The **Key Vault Reader** role grants read access to Key Vault metadata — vault properties, and the names of secrets and keys — but does not grant permission to view secret values or key material. It is a management-plane role only. You will verify this boundary in the next section.

1. On the **Members** tab, set **Assign access to** to **User, group, or service principal**.

1. Select **+ Select members**, search for and select **User-2**, then select **Select**.

1. Select **Review + assign**, then select **Review + assign** again to save.

1. On the **Access control (IAM)** page, select the **Role assignments** tab and confirm the following four assignments are listed:

    | Principal | Role |
    |-----------|------|
    | User-1 | Key Vault Secrets Officer |
    | User-1 | Key Vault Crypto Officer |
    | my-own-app | Key Vault Secrets User |
    | User-2 | Key Vault Reader |

    > **Note**: In a production environment, consider making the **Key Vault Secrets Officer** and **Key Vault Crypto Officer** assignments eligible through Privileged Identity Management (PIM) rather than active. This removes standing data-plane access entirely — administrators activate the role just-in-time when they need to manage vault contents, and access automatically expires.

---

## Store secrets and keys

I will now store two objects in the vault: 

* A secret that represents the AI application's model endpoint API key
* A cryptographic key that represents a data encryption key managed through Key Vault. These objects will be used in the access verification and managed identity retrieval steps that follow.

1. In the left menu of the Key Vault, select **Objects** then **Secrets**.

1. Select **+ Generate/Import**.

1. On the **Create a secret** page, configure the following:

    | Setting | Value |
    |---------|-------|
    | **Upload options** | Manual |
    | **Name** | `foundry-api-key` |
    | **Secret value** | `sk-foundry-demo-00000000000000000000000000000001` |
    | **Enabled** | Yes |
    
    > **Generating secret value with terminal:** openssl rand -base64 32

1. Select **Create**.

    The secret appears in the Secrets list with a status of **Enabled**.

1. In the left menu, select **Keys**.

1. Select **+ Generate/Import**.

1. On the **Create a key** page, configure the following:

    | Setting | Value |
    |---------|-------|
    | **Options** | Generate |
    | **Name** | `data-encryption-key` |
    | **Key type** | RSA |
    | **RSA key size** | 2048 |
    | **Enabled** | Yes |

1. Select **Create**.

    The key appears in the Keys list with a status of **Enabled**.

    > **Note**: Key Vault stores the RSA private key material inside the vault and never exposes it directly. Applications interact with the key by calling Key Vault cryptographic operations — encrypt, decrypt, sign, verify — rather than extracting the raw key. This keeps the private key permanently protected and audited inside the vault.

---

## Verify access control enforcement

The **Key Vault Reader** role grants management-plane access only — a user assigned this role can see that secrets exist and view their names, but cannot read secret values. I will sign in as **User-2** to confirm that the role boundary is enforced at the data plane.

1. Open a new **InPrivate** or **Private** browser window.

1. Navigate to the Azure Portal at `https://portal.azure.com` and sign in using the **User-2** credentials from the **Resources** tab.

1. In the search bar, search for and select **Key vaults**.

1. Select **sc500KV** from the list.

1. In the left menu open **Objects**, then select **Secrets**.

    Confirm that **foundry-api-key** appears in the list. The Key Vault Reader role grants `sc500-user03` management-plane access, so the secret name is visible.

1. Select **foundry-api-key** to open the secret, then select the current version.

1. On the secret version page, select **Show Secret Value**.

    Confirm that an error message appears, such as **"The operation is not allowed by RBAC. If role assignments were recently changed, please wait several minutes for role assignments to become effective."** or an access denied notification.

    > **Note**: The Key Vault Reader role includes `Microsoft.KeyVault/vaults/read` (management plane) but does not include `Microsoft.KeyVault/vaults/secrets/getSecret/action` (data plane). This means `sc500-user03` can enumerate secrets but cannot retrieve their values — precisely the boundary that separates the Reader role from the Secrets User role.

1. Close the InPrivate browser window and return to your Global Administrator browser session.

---

## Enable Defender for Key Vault

Microsoft Defender for Key Vault detects unusual and potentially harmful access patterns — including access from known malicious IP addresses, suspicious retrieval volumes, and anomalous geographic locations. I will enable the Defender for Key Vault protection plan on the subscription and configure the vault to forward audit logs to the pre-provisioned Log Analytics workspace.

1. In the Azure portal `https://portal.azure.com` search bar, search for and select **`Microsoft Defender for Cloud`**.

1. In the left menu, under **Management**, select **Environment settings**.  Scroll to the bottom of the page.

1. Use the **Expand All** button to expand your subscription node and select your subscription.

1. On the **Defender plans** page, locate **Key Vault** in the list of resource types.

1. Set the **Key Vault** plan status to **On**.

1. Select **Save**.

    > **Note**: Enabling Defender for Key Vault activates threat detection across all Key Vaults in the subscription, including the vault you created in this lab. Alerts are generated for anomalies such as access from Tor exit nodes, access from atypical geographic locations, and bulk secret retrieval patterns that may indicate a credential harvesting attempt.

1. Navigate back to your Key Vault, **sc500-kv-@lab.LabInstance.Id**.

1. In the left menu, under **Monitoring**, select **Diagnostic settings**.

1. Select **+ Add diagnostic setting**.

1. Configure the following:

    | Setting | Value |
    |---------|-------|
    | **Diagnostic setting name** | `sc500-kv-diag` |
    | **Logs — Category groups** | Check **audit** |
    | **Destination details** | Check **Send to Log Analytics workspace** |
    | **Subscription** | Your lab subscription |
    | **Log Analytics workspace** | sc500-lab1c-log |

1. Select **Save**.

1. Confirm that **sc500-kv-diag** now appears in the Diagnostic settings list.

    > **Note**: Diagnostic settings forward all Key Vault audit events — read, write, and delete operations on secrets, keys, and certificates — to the Log Analytics workspace. This telemetry feeds into Defender for Key Vault alert enrichment and supports security investigations and compliance reporting. Allow up to 15 minutes for the first log entries to appear in the workspace after the setting is saved.

---

End

[Source](https://github.com/MicrosoftLearning/mslearn-sec-identity/blob/master/Instructions/Labs/Lab-1C-Secure-KeyVault.md)