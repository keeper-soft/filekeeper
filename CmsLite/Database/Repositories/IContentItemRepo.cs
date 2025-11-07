using System;
using CmsLite.Helpers.RequestMappers;

namespace CmsLite.Database.Repositories;

public interface IContentItemRepo
{
    Task<DbSet.ContentItem?> GetContentItemByIdAsync(string contentItemId);
    Task CreateContentItemAsync(DbSet.ContentItem contentItem);
    Task DeleteContentItemAsync(string contentItemId);
    Task<List<DbSet.ContentItem>> GetContentItemsByDirectoryIdAsync(string directoryId);
    Task<List<DbSet.ContentItem>> GetContentItemsByTenantIdAsync(string tenantId);
    Task<DbSet.ContentItem?> GetContentItemByTenantAndResourceAsync(string tenantId, string resource);
    Task<ContentDetailsResponse?> GetContentItemDetailsAsync(string tenantId, string resource, CancellationToken cancellationToken);
    Task<int?> GetContentItemIdByDirectoryAndResourceAsync(string directoryId, string resource, CancellationToken cancellationToken);
}
