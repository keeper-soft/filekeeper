using System;
using Microsoft.EntityFrameworkCore;
using CmsLite.Helpers.RequestMappers;

namespace CmsLite.Database.Repositories;

public class ContentItemRepo : IContentItemRepo
{
    private readonly CmsLiteDbContext dbContext;
    public ContentItemRepo(CmsLiteDbContext dbContext)
    {
        this.dbContext = dbContext;
    }
    public async Task CreateContentItemAsync(DbSet.ContentItem contentItem)
    {
        await dbContext.ContentItemsTable.AddAsync(contentItem);
        await dbContext.SaveChangesAsync();
    }

    public async Task DeleteContentItemAsync(string contentItemId)
    {
        var contentItem = await GetContentItemByIdAsync(contentItemId);
        if (contentItem != null)
        {
            contentItem.IsDeleted = true; // Soft delete
            await dbContext.SaveChangesAsync();
        }
    }

    public async Task<DbSet.ContentItem?> GetContentItemByIdAsync(string contentItemId)
    {
        return await dbContext.ContentItemsTable.FindAsync(contentItemId);
    }

    public async Task<List<DbSet.ContentItem>> GetContentItemsByDirectoryIdAsync(string directoryId)
    {
        return await dbContext.ContentItemsTable
            .Where(ci => ci.DirectoryId == directoryId && !ci.IsDeleted)
            .ToListAsync();
    }

    public async Task<List<DbSet.ContentItem>> GetContentItemsByTenantIdAsync(string tenantId)
    {
        return await dbContext.ContentItemsTable.Where(ci => ci.TenantId == tenantId && !ci.IsDeleted).ToListAsync();
    }

    public async Task<DbSet.ContentItem?> GetContentItemByTenantAndResourceAsync(string tenantId, string resource)
    {
        return await dbContext.ContentItemsTable
            .Include(ci => ci.Directory)
            .FirstOrDefaultAsync(ci => ci.TenantId == tenantId && ci.Resource == resource && !ci.IsDeleted);
    }

    public async Task<ContentDetailsResponse?> GetContentItemDetailsAsync(string tenantId, string resource, CancellationToken cancellationToken)
    {
        // Get the main content item with related data
        var contentItem = await dbContext.ContentItemsTable
            .Include(ci => ci.Directory)
            .Include(ci => ci.Tenant)
            .FirstOrDefaultAsync(ci => ci.TenantId == tenantId && ci.Resource == resource && !ci.IsDeleted);

        if (contentItem == null)
        {
            return null;
        }

        // Get all versions for this resource
        var versions = await dbContext.ContentVersionsTable
            .Where(cv => cv.TenantId == tenantId && cv.Resource == resource)
            .OrderByDescending(cv => cv.Version)
            .ToListAsync();

        // Build directory full path
        var directoryPath = await BuildDirectoryFullPathAsync(contentItem.Directory);

        // Extract file extension
        var fileExtension = Path.GetExtension(resource);

        return new ContentDetailsResponse
        {
            Resource = contentItem.Resource,
            LatestVersion = contentItem.LatestVersion,
            ContentType = contentItem.ContentType,
            Size = Helpers.Utilities.CalculateFileSizeInBestUnit(contentItem.ByteSize),
            CreatedAtUtc = contentItem.CreatedAtUtc,
            UpdatedAtUtc = contentItem.UpdatedAtUtc,
            IsDeleted = contentItem.IsDeleted,

            Directory = new ContentDirectoryInfo
            {
                Id = contentItem.Directory.Id,
                Name = contentItem.Directory.Name,
                FullPath = directoryPath,
                Level = contentItem.Directory.Level
            },

            Versions = versions.Select(v => new VersionSummary
            {
                Version = v.Version,
                Size = Helpers.Utilities.CalculateFileSizeInBestUnit(v.ByteSize),
                CreatedAtUtc = v.CreatedAtUtc
            }).ToList(),

            Metadata = new ContentMetadata
            {
                TenantId = contentItem.TenantId,
                TenantName = contentItem.Tenant.Name,
                HasMultipleVersions = versions.Count > 1,
                TotalVersions = versions.Count,
                FileExtension = fileExtension,
                ReadableSize = FormatBytes(contentItem.ByteSize)
            }
        };
    }

    private async Task<string> BuildDirectoryFullPathAsync(DbSet.Directory directory)
    {
        var pathParts = new List<string>();
        var current = directory;

        while (current != null)
        {
            if (current.ParentId == null)
            {
                // This is root directory, don't include it in path unless it has a meaningful name
                if (current.Name != "Root")
                {
                    pathParts.Insert(0, current.Name);
                }
                break;
            }

            pathParts.Insert(0, current.Name);
            current = await dbContext.DirectoriesTable.FirstOrDefaultAsync(d => d.Id == current.ParentId);
        }

        if (pathParts.Count == 0)
        {
            return "/";
        }
        var sb = new System.Text.StringBuilder();
        sb.Append("/");
        for (int i = 0; i < pathParts.Count; i++)
        {
            sb.Append(pathParts[i]);
            if (i < pathParts.Count - 1)
            {
                sb.Append("/");
            }
        }
        return sb.ToString();
    }

    private static string FormatBytes(long bytes)
    {
        const long kb = 1024;
        const long mb = kb * 1024;
        const long gb = mb * 1024;

        return bytes switch
        {
            >= gb => $"{bytes / (double)gb:F1} GB",
            >= mb => $"{bytes / (double)mb:F1} MB",
            >= kb => $"{bytes / (double)kb:F1} KB",
            _ => $"{bytes} bytes"
        };
    }

    Task<int?> IContentItemRepo.GetContentItemIdByDirectoryAndResourceAsync(string directoryId, string resource, CancellationToken cancellationToken)
    {
        return dbContext.ContentItemsTable
            .Where(ci => ci.DirectoryId == directoryId && ci.Resource == resource && !ci.IsDeleted)
            .OrderByDescending(ci => ci.LatestVersion)
            .Select(ci => (int?)ci.Id)
            .FirstOrDefaultAsync();
    }
}
