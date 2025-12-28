output "resource_group_name" {
  description = "Resource group name"
  value       = azurerm_resource_group.main.name
}

# AKS outputs
output "aks_cluster_name" {
  description = "AKS cluster name"
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_cluster_id" {
  description = "AKS cluster ID"
  value       = azurerm_kubernetes_cluster.main.id
}

output "aks_kube_config_command" {
  description = "Command to configure kubectl"
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name}"
}

# ACR outputs
output "acr_name" {
  description = "Container registry name"
  value       = azurerm_container_registry.main.name
}

output "acr_login_server" {
  description = "Container registry login server"
  value       = azurerm_container_registry.main.login_server
}

output "acr_admin_username" {
  description = "Container registry admin username"
  value       = azurerm_container_registry.main.admin_username
  sensitive   = true
}

output "acr_admin_password" {
  description = "Container registry admin password"
  value       = azurerm_container_registry.main.admin_password
  sensitive   = true
}

# Key Vault outputs
output "key_vault_name" {
  description = "Key Vault name"
  value       = azurerm_key_vault.main.name
}

output "key_vault_uri" {
  description = "Key Vault URI"
  value       = azurerm_key_vault.main.vault_uri
}

output "managed_identity_client_id" {
  description = "Managed identity client ID for Key Vault access"
  value       = azurerm_user_assigned_identity.keyvault.client_id
}

# PostgreSQL outputs
output "postgres_host" {
  description = "PostgreSQL server hostname"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgres_database" {
  description = "PostgreSQL database name"
  value       = azurerm_postgresql_flexible_server_database.main.name
}

output "postgres_admin_username" {
  description = "PostgreSQL admin username"
  value       = azurerm_postgresql_flexible_server.main.administrator_login
  sensitive   = true
}

# Azure tenant ID (for Helm values)
output "azure_tenant_id" {
  description = "Azure AD tenant ID"
  value       = data.azurerm_client_config.current.tenant_id
}

# GitHub Actions variables (copy these to repository settings)
output "github_actions_variables" {
  description = "Variables to set in GitHub repository settings"
  value = {
    ACR_NAME                   = azurerm_container_registry.main.name
    AKS_CLUSTER                = azurerm_kubernetes_cluster.main.name
    AKS_RESOURCE_GROUP         = azurerm_resource_group.main.name
    KEY_VAULT_NAME             = azurerm_key_vault.main.name
    AZURE_TENANT_ID            = data.azurerm_client_config.current.tenant_id
    MANAGED_IDENTITY_CLIENT_ID = azurerm_user_assigned_identity.keyvault.client_id
  }
}
