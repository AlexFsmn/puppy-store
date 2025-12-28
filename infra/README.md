# Puppy Store Infrastructure

Terraform configuration for Azure infrastructure.

## Resources Created

- **Resource Group** - Container for all resources
- **AKS Cluster** - Kubernetes cluster with:
  - Secrets Store CSI Driver (for Key Vault integration)
  - Workload Identity enabled
  - Auto-scaling node pool
- **Azure Container Registry** - Docker image storage
- **PostgreSQL Flexible Server** - Database with private networking
- **Key Vault** - Secure secret storage
- **Virtual Network** - Private networking for all resources

## Prerequisites

1. [Terraform](https://www.terraform.io/downloads) >= 1.5.0
2. [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
3. Azure subscription with Owner/Contributor access

## Quick Start

```bash
# Login to Azure
az login

# Initialize Terraform (first time only)
terraform init

# Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Preview changes
terraform plan

# Apply changes
terraform apply
```

## Remote State Setup (Recommended)

For team collaboration, use Azure Storage for remote state:

```bash
# Create storage account for state
az group create -n tfstate-rg -l eastus
az storage account create -n puppystoretfstate -g tfstate-rg -l eastus --sku Standard_LRS
az storage container create -n tfstate --account-name puppystoretfstate

# Initialize with backend
terraform init \
  -backend-config="resource_group_name=tfstate-rg" \
  -backend-config="storage_account_name=puppystoretfstate" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=puppy-store.tfstate"
```

## Post-Deployment

After `terraform apply`, you'll get outputs for configuring GitHub Actions.

1. **Configure kubectl:**
   ```bash
   az aks get-credentials --resource-group <rg-name> --name <aks-name>
   ```

2. **Set GitHub repository variables** (from `github_actions_variables` output):
   - `ACR_NAME`
   - `AKS_CLUSTER`
   - `AKS_RESOURCE_GROUP`
   - `KEY_VAULT_NAME`
   - `AZURE_TENANT_ID`
   - `MANAGED_IDENTITY_CLIENT_ID`

3. **Set GitHub repository secrets:**
   ```bash
   # Get ACR credentials
   terraform output -raw acr_admin_username
   terraform output -raw acr_admin_password
   ```
   - `ACR_USERNAME` - ACR admin username
   - `ACR_PASSWORD` - ACR admin password
   - `AZURE_CREDENTIALS` - Service principal JSON for Azure login

4. **Create Azure service principal for GitHub Actions:**
   ```bash
   az ad sp create-for-rbac --name "github-actions-puppy-store" \
     --role contributor \
     --scopes /subscriptions/<subscription-id>/resourceGroups/<rg-name> \
     --sdk-auth
   ```
   Copy the JSON output to `AZURE_CREDENTIALS` secret.

## Updating Secrets

To update secrets in Key Vault:

```bash
# Via Terraform (update tfvars and apply)
terraform apply -target=azurerm_key_vault_secret.openai_api_key

# Or via Azure CLI
az keyvault secret set --vault-name <kv-name> --name openai-api-key --value <new-value>
```

## Costs

Estimated monthly costs (East US, as of 2024):
- AKS (2x D2s_v3): ~$140
- PostgreSQL (B_Standard_B1ms): ~$25
- ACR (Basic): ~$5
- Key Vault: ~$1
- **Total: ~$170/month**

Use `aks_node_count = 1` and smaller VM sizes for dev/staging.

## Cleanup

```bash
terraform destroy
```
