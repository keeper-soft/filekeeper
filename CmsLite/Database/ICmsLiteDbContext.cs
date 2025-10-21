using System;

namespace CmsLite.Database;

/// <summary>
/// Signature for CmsLiteDbContext to be used in DI and unit testing.
/// </summary>
public interface ICmsLiteDbContext
{
    Microsoft.EntityFrameworkCore.DbSet<DbSet.User> Users { get; }
    Microsoft.EntityFrameworkCore.DbSet<DbSet.UserSession> UserSessions { get; }
    Microsoft.EntityFrameworkCore.DbSet<DbSet.ContentItem> ContentItems { get; }
    Microsoft.EntityFrameworkCore.DbSet<DbSet.ContentVersion> ContentVersions { get; }
    Microsoft.EntityFrameworkCore.DbSet<DbSet.Tenant> Tenants { get; }
    Microsoft.EntityFrameworkCore.DbSet<DbSet.Directory> Directories { get; }
    Microsoft.EntityFrameworkCore.DbSet<DbSet.Favorite> Favorites { get; }
}
