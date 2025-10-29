using System;
using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Specialized;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace CmsLite.Database;

public class CmsLiteDbContext : DbContext, ICmsLiteDbContext
{
    public CmsLiteDbContext(DbContextOptions<CmsLiteDbContext> opts) : base(opts) { }
    public Microsoft.EntityFrameworkCore.DbSet<DbSet.User> UsersTable => Set<DbSet.User>();
    public Microsoft.EntityFrameworkCore.DbSet<DbSet.UserSession> UserSessionsTable => Set<DbSet.UserSession>();
    public Microsoft.EntityFrameworkCore.DbSet<DbSet.Tenant> TenantsTable => Set<DbSet.Tenant>();
    public Microsoft.EntityFrameworkCore.DbSet<DbSet.ContentItem> ContentItemsTable => Set<DbSet.ContentItem>();
    public Microsoft.EntityFrameworkCore.DbSet<DbSet.ContentVersion> ContentVersionsTable => Set<DbSet.ContentVersion>();
    public Microsoft.EntityFrameworkCore.DbSet<DbSet.Directory> DirectoriesTable => Set<DbSet.Directory>();
    public Microsoft.EntityFrameworkCore.DbSet<DbSet.Favorite> FavoritesTable => Set<DbSet.Favorite>();

    Microsoft.EntityFrameworkCore.DbSet<DbSet.User> ICmsLiteDbContext.Users => UsersTable;

    Microsoft.EntityFrameworkCore.DbSet<DbSet.UserSession> ICmsLiteDbContext.UserSessions => UserSessionsTable;

    Microsoft.EntityFrameworkCore.DbSet<DbSet.ContentItem> ICmsLiteDbContext.ContentItems => ContentItemsTable;

    Microsoft.EntityFrameworkCore.DbSet<DbSet.Directory> ICmsLiteDbContext.Directories => DirectoriesTable;

    Microsoft.EntityFrameworkCore.DbSet<DbSet.ContentVersion> ICmsLiteDbContext.ContentVersions => ContentVersionsTable;

    Microsoft.EntityFrameworkCore.DbSet<DbSet.Tenant> ICmsLiteDbContext.Tenants => TenantsTable;

    Microsoft.EntityFrameworkCore.DbSet<DbSet.Favorite> ICmsLiteDbContext.Favorites => Set<DbSet.Favorite>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DbSet.User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Id).IsUnique();
            entity.Property(e => e.LastName).HasMaxLength(100);
            entity.Property(e => e.FirstName).HasMaxLength(100);
            entity.HasOne(u => u.Tenant)
                .WithMany(t => t.Users)
                .HasForeignKey(u => u.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<DbSet.Directory>(entity =>
        {
            entity.HasKey(e => e.Id);
            // Unique constraint for subdirectories under the same parent within a tenant
            entity.HasIndex(e => new { e.TenantId, e.ParentId, e.Name }).IsUnique()
            .HasFilter("ParentId IS NOT NULL");
            // Unique constraint for root directories within a tenant -> only one root directory per tenant 
            entity.HasIndex(e => new { e.TenantId }).IsUnique()
            .HasFilter("ParentId IS NULL");
            entity.Property(e => e.Name).HasMaxLength(128);
            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Parent)
                .WithMany(d => d.SubDirectories)
                .HasForeignKey(e => e.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<DbSet.UserSession>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Id).IsUnique();
            entity.HasOne(e => e.User)
                .WithMany(u => u.UserSessions)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DbSet.Tenant>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Id).IsUnique();
            entity.HasIndex(e => e.Name).IsUnique();
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
        });
        modelBuilder.Entity<DbSet.ContentItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.TenantId, e.Resource }).IsUnique();
            entity.HasIndex(e => e.DirectoryId);
            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.ContentItems)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Directory)
                .WithMany(d => d.ContentItems)
                .HasForeignKey(e => e.DirectoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<DbSet.ContentVersion>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.TenantId, e.Resource, e.Version }).IsUnique();
            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<DbSet.Favorite>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.ContentItemId }).IsUnique();
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.ContentItem)
                .WithMany()
                .HasForeignKey(e => e.ContentItemId)
                .OnDelete(DeleteBehavior.NoAction);
        });
    }
}

public static class DbSet
{
    public class ContentItem
    {
        public int Id { get; set; }
        public string TenantId { get; set; } = default!;  // Foreign key
        public string DirectoryId { get; set; } = default!; // Foreign key
        public string Resource { get; set; } = default!;
        public int LatestVersion { get; set; }
        public string ContentType { get; set; } = default!;
        public long ByteSize { get; set; }
        public string Sha256 { get; set; } = default!;
        public string ETag { get; set; } = default!;
        public DateTime CreatedAtUtc { get; set; }
        public DateTime UpdatedAtUtc { get; set; }
        public bool IsDeleted { get; set; }

        // Navigation properties
        public Tenant Tenant { get; set; } = default!;
        public Directory Directory { get; set; } = default!;
    }
    public class ContentVersion
    {
        public int Id { get; set; }
        public string TenantId { get; set; } = default!;  // Foreign key
        public string Resource { get; set; } = default!;
        public int Version { get; set; }
        public long ByteSize { get; set; }
        public string Sha256 { get; set; } = default!;
        public string ETag { get; set; } = default!;
        public DateTime CreatedAtUtc { get; set; }

        // Navigation properties
        public Tenant Tenant { get; set; } = default!;
    }
    public class Tenant
    {
        public string Id { get; set; } = default!;
        public string Name { get; set; } = default!;
        public string Description { get; set; } = default!;
        public DateTime CreatedAtUtc { get; set; }
        public DateTime UpdatedAtUtc { get; set; }

        // Navigation properties
        public ICollection<User> Users { get; set; } = new List<User>();
        public ICollection<ContentItem> ContentItems { get; set; } = new List<ContentItem>();
    }
    public class User
    {
        public string Id { get; set; } = default!;
        public string TenantId { get; set; } = default!;
        public string Email { get; set; } = default!;
        public string FirstName { get; set; } = default!;
        public string LastName { get; set; } = default!;
        public string PasswordHash { get; set; } = default!;
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? LastLoginAtUtc { get; set; }

        // Navigation properties
        public Tenant Tenant { get; set; } = default!;
        public ICollection<UserSession> UserSessions { get; set; } = new List<UserSession>();

    }
    public class UserSession
    {
        public string Id { get; set; } = default!;
        public string UserId { get; set; } = default!;

        public DbSet.User User { get; set; } = default!;
        public string JwtToken { get; set; } = default!;
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAtUtc { get; set; } = DateTime.UtcNow.AddMinutes(30);
        public bool IsRevoked { get; set; } = false;

    }
    public class Directory
    {
        public string Id { get; set; } = default!;
        public string TenantId { get; set; } = default!; // Foreign key
        public string? ParentId { get; set; } = null;
        public string Name { get; set; } = default!;
        public int Level { get; set; } = 0; // Root directories have level 0
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;

        // Navigation properties
        public Tenant Tenant { get; set; } = default!;
        public Directory? Parent { get; set; }
        public ICollection<Directory> SubDirectories { get; set; } = new List<Directory>();
        public ICollection<ContentItem> ContentItems { get; set; } = new List<ContentItem>();
    }
    public class Favorite
    {
        public string Id { get; set; } = default!;
        public string UserId { get; set; } = default!; // Foreign key
        public int ContentItemId { get; set; } = default!; // Foreign key - must match ContentItem.Id type (int)
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public User User { get; set; } = default!;
        public ContentItem ContentItem { get; set; } = default!;
    }
}


